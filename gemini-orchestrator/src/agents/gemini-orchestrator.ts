/**
 * Gemini Orchestration Agent
 * Central AI agent that manages configurations, analysis, and reporting
 * for the vibe-check safety analysis system
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { EventEmitter } from 'events';
import winston from 'winston';
import cron from 'node-cron';
import { z } from 'zod';

import type { 
  VibeCheckConfig, 
  VibeCheckAnalysis, 
  AgentState, 
  AgentMessage,
  AgentMetrics 
} from '../../shared/types/index.js';

import { ConfigurationManager } from '../services/config-manager.js';
import { VisionService } from '../services/vision-service.js';
import { ViolationSanityService } from '../services/violation-sanity-service.js';
import { DataSourceService } from '../services/data-source-service.js';
import { ReportingService } from '../services/reporting-service.js';

const GeminiResponseSchema = z.object({
  action: z.enum(['update-config', 'analyze', 'report', 'audit', 'optimize']),
  reasoning: z.string(),
  configurations: z.record(z.any()).optional(),
  recommendations: z.array(z.string()).optional(),
  metrics: z.record(z.number()).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional()
});

export class GeminiOrchestrator extends EventEmitter {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private logger: winston.Logger;
  private state: AgentState;
  private config: VibeCheckConfig;
  
  // Service instances
  private configManager: ConfigurationManager;
  private visionService: VisionService;
  private violationService: ViolationSanityService;
  private dataService: DataSourceService;
  private reportingService: ReportingService;

  constructor(apiKey: string, initialConfig: VibeCheckConfig) {
    super();
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: initialConfig.orchestration.agent.model 
    });
    
    this.config = initialConfig;
    this.setupLogger();
    this.initializeState();
    this.initializeServices();
    this.setupCronJobs();
  }

  private setupLogger(): void {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/orchestrator.log' }),
        new winston.transports.Console()
      ]
    });
  }

  private initializeState(): void {
    this.state = {
      id: 'gemini-orchestrator',
      status: 'idle',
      lastActivity: Date.now(),
      currentTasks: [],
      capabilities: [
        'configuration-management',
        'analysis-orchestration',
        'self-supervised-auditing',
        'adaptive-optimization',
        'report-generation'
      ],
      metrics: {
        totalAnalyses: 0,
        successRate: 1.0,
        avgProcessingTime: 0,
        errorCount: 0,
        configChanges: 0
      }
    };
  }

  private initializeServices(): void {
    this.configManager = new ConfigurationManager(this.config);
    this.visionService = new VisionService(this.config.vision);
    this.violationService = new ViolationSanityService(this.config.violation);
    this.dataService = new DataSourceService(this.config.data);
    this.reportingService = new ReportingService(this.config.orchestration.reporting);
  }

  private setupCronJobs(): void {
    // Self-audit job
    cron.schedule(this.config.orchestration.audit.frequency, () => {
      this.performSelfAudit();
    });

    // Reporting jobs
    this.config.orchestration.reporting.intervals.forEach(interval => {
      cron.schedule(interval.cron, () => {
        this.generateReport(interval.reportType);
      });
    });

    this.logger.info('Cron jobs initialized', { 
      auditFrequency: this.config.orchestration.audit.frequency,
      reportingIntervals: this.config.orchestration.reporting.intervals.length
    });
  }

  /**
   * Main orchestration method - analyzes input and coordinates services
   */
  async orchestrateAnalysis(imageData: Buffer, metadata: any): Promise<VibeCheckAnalysis> {
    const startTime = Date.now();
    this.state.status = 'processing';
    this.state.currentTasks.push('analysis');
    
    try {
      // Step 1: Get AI agent's analysis plan
      const analysisInstructions = await this.getAnalysisInstructions(metadata);
      
      // Step 2: Execute vision analysis
      const visionResults = await this.visionService.analyze(imageData, analysisInstructions.vision);
      
      // Step 3: Execute violation analysis if needed
      let violationResults = null;
      if (analysisInstructions.checkViolations) {
        violationResults = await this.violationService.analyze(imageData, analysisInstructions.violation);
      }
      
      // Step 4: Get AI interpretation and recommendations
      const interpretation = await this.interpretResults(visionResults, violationResults, metadata);
      
      // Step 5: Assemble final analysis
      const analysis: VibeCheckAnalysis = {
        id: `analysis-${Date.now()}`,
        timestamp: Date.now(),
        location: metadata.location,
        visionResults,
        violationResults,
        safetyScore: interpretation.safetyScore,
        riskLevel: interpretation.riskLevel,
        recommendations: interpretation.recommendations,
        metadata: {
          processingTime: Date.now() - startTime,
          modelVersions: {
            orchestrator: this.config.orchestration.agent.model,
            vision: this.config.vision.model
          },
          confidence: interpretation.confidence,
          source: 'gemini-orchestrator',
          territory: metadata.territory
        }
      };

      // Update metrics
      this.updateMetrics(true, Date.now() - startTime);
      this.state.status = 'idle';
      this.state.currentTasks = this.state.currentTasks.filter(t => t !== 'analysis');
      
      this.logger.info('Analysis completed', {
        analysisId: analysis.id,
        safetyScore: analysis.safetyScore,
        processingTime: analysis.metadata.processingTime
      });

      return analysis;

    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      this.state.status = 'error';
      this.logger.error('Analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get analysis instructions from Gemini agent
   */
  private async getAnalysisInstructions(metadata: any): Promise<any> {
    const prompt = `
As the vibe-check orchestration agent, analyze this request and provide analysis instructions:

Request metadata: ${JSON.stringify(metadata)}
Current configuration: ${JSON.stringify(this.config)}
Current metrics: ${JSON.stringify(this.state.metrics)}

Provide instructions for:
1. Vision analysis parameters
2. Whether to check for violations  
3. What contextual data to gather
4. Analysis priorities

Respond with JSON matching this schema:
{
  "vision": {
    "focusAreas": ["bikes", "pedestrians", "infrastructure"],
    "sensitivity": "high|medium|low",
    "contextualFactors": ["weather", "time", "traffic"]
  },
  "checkViolations": boolean,
  "violation": {
    "type": "sidewalk_cycling|blocking|other",
    "priority": "high|medium|low"
  },
  "dataGathering": ["weather", "historical", "traffic"],
  "reasoning": "explanation of decisions"
}`;

    const result = await this.model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      return JSON.parse(response);
    } catch (error) {
      this.logger.warn('Failed to parse analysis instructions, using defaults', { response });
      return this.getDefaultAnalysisInstructions();
    }
  }

  /**
   * Interpret analysis results using Gemini
   */
  private async interpretResults(visionResults: any, violationResults: any, metadata: any): Promise<any> {
    const prompt = `
As the vibe-check orchestration agent, interpret these analysis results:

Vision Analysis: ${JSON.stringify(visionResults)}
Violation Analysis: ${JSON.stringify(violationResults)}
Context: ${JSON.stringify(metadata)}
Historical Performance: ${JSON.stringify(this.state.metrics)}

Provide interpretation with:
1. Overall safety score (0-10)
2. Risk level classification  
3. Specific recommendations
4. Confidence level
5. Key insights

Respond with JSON matching this schema:
{
  "safetyScore": number,
  "riskLevel": "low|moderate|high|critical",
  "recommendations": ["string"],
  "confidence": number,
  "insights": ["string"],
  "reasoning": "detailed explanation"
}`;

    const result = await this.model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      return JSON.parse(response);
    } catch (error) {
      this.logger.warn('Failed to parse interpretation, using fallback', { response });
      return this.getFallbackInterpretation(visionResults, violationResults);
    }
  }

  /**
   * Perform self-supervised audit
   */
  async performSelfAudit(): Promise<void> {
    this.logger.info('Starting self-audit');
    this.state.currentTasks.push('audit');

    try {
      const auditPrompt = `
As the vibe-check orchestration agent, perform a self-audit:

Current State: ${JSON.stringify(this.state)}
Current Configuration: ${JSON.stringify(this.config)}
Recent Performance: ${JSON.stringify(this.state.metrics)}

Audit areas:
1. Configuration effectiveness
2. Performance metrics
3. Accuracy trends  
4. Resource utilization
5. Compliance with objectives

Provide audit report with:
- Overall health score
- Issues identified
- Recommended actions
- Configuration updates needed
- Performance optimizations

Respond with JSON schema for audit report.`;

      const result = await this.model.generateContent(auditPrompt);
      const auditReport = JSON.parse(result.response.text());
      
      // Process audit recommendations
      await this.processAuditRecommendations(auditReport);
      
      this.logger.info('Self-audit completed', { 
        healthScore: auditReport.healthScore,
        issuesFound: auditReport.issues?.length || 0
      });

    } catch (error) {
      this.logger.error('Self-audit failed', { error: error.message });
    } finally {
      this.state.currentTasks = this.state.currentTasks.filter(t => t !== 'audit');
    }
  }

  /**
   * Generate report for specified interval
   */
  async generateReport(reportType: string): Promise<void> {
    this.logger.info('Generating report', { reportType });
    
    try {
      const reportData = await this.reportingService.generateReport(reportType, this.state);
      
      this.emit('report-generated', {
        type: reportType,
        data: reportData,
        timestamp: Date.now()
      });
      
    } catch (error) {
      this.logger.error('Report generation failed', { reportType, error: error.message });
    }
  }

  /**
   * Update configuration based on AI recommendations
   */
  async updateConfiguration(updates: Partial<VibeCheckConfig>): Promise<void> {
    this.logger.info('Updating configuration', { updates });
    
    try {
      const newConfig = await this.configManager.updateConfig(updates);
      this.config = newConfig;
      
      // Reinitialize services with new config
      this.reinitializeServices();
      
      this.state.metrics.configChanges++;
      this.emit('config-updated', { config: newConfig });
      
    } catch (error) {
      this.logger.error('Configuration update failed', { error: error.message });
      throw error;
    }
  }

  // Utility methods
  private getDefaultAnalysisInstructions(): any {
    return {
      vision: {
        focusAreas: ['bikes', 'pedestrians', 'infrastructure'],
        sensitivity: 'medium',
        contextualFactors: ['time', 'weather']
      },
      checkViolations: true,
      violation: {
        type: 'sidewalk_cycling',
        priority: 'medium'
      },
      dataGathering: ['weather', 'historical'],
      reasoning: 'Using default analysis parameters'
    };
  }

  private getFallbackInterpretation(visionResults: any, violationResults: any): any {
    // Simple fallback interpretation logic
    const baseScore = 7; // Start with moderate safety
    let safetyScore = baseScore;
    
    if (violationResults && violationResults.severity > 5) {
      safetyScore -= 2;
    }
    
    const riskLevel = safetyScore >= 7 ? 'low' : 
                     safetyScore >= 5 ? 'moderate' : 
                     safetyScore >= 3 ? 'high' : 'critical';

    return {
      safetyScore,
      riskLevel,
      recommendations: ['Monitor area for patterns', 'Consider infrastructure improvements'],
      confidence: 0.6,
      insights: ['Fallback interpretation used'],
      reasoning: 'AI interpretation failed, using rule-based fallback'
    };
  }

  private updateMetrics(success: boolean, processingTime: number): void {
    this.state.metrics.totalAnalyses++;
    
    if (success) {
      this.state.metrics.avgProcessingTime = 
        (this.state.metrics.avgProcessingTime + processingTime) / 2;
    } else {
      this.state.metrics.errorCount++;
    }
    
    this.state.metrics.successRate = 
      (this.state.metrics.totalAnalyses - this.state.metrics.errorCount) / 
      this.state.metrics.totalAnalyses;
    
    this.state.lastActivity = Date.now();
  }

  private async processAuditRecommendations(auditReport: any): Promise<void> {
    if (auditReport.configUpdates) {
      await this.updateConfiguration(auditReport.configUpdates);
    }
    
    if (auditReport.actions) {
      for (const action of auditReport.actions) {
        this.logger.info('Processing audit action', { action });
        // Implement specific actions based on audit recommendations
      }
    }
  }

  private reinitializeServices(): void {
    this.visionService = new VisionService(this.config.vision);
    this.violationService = new ViolationSanityService(this.config.violation);
    this.dataService = new DataSourceService(this.config.data);
    this.reportingService = new ReportingService(this.config.orchestration.reporting);
  }

  // Public getters
  getState(): AgentState {
    return { ...this.state };
  }

  getConfig(): VibeCheckConfig {
    return { ...this.config };
  }

  getMetrics(): AgentMetrics {
    return { ...this.state.metrics };
  }
} 