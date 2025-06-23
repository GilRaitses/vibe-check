// Shared types for vibe-check system

export interface VibeCheckConfig {
  vision: VisionAnalysisConfig;
  violation: ViolationSanityConfig;
  data: DataSourceConfig;
  orchestration: OrchestrationConfig;
}

export interface VisionAnalysisConfig {
  variables: VisionVariable[];
  prompt: string;
  responseFormat: string;
  model: string;
}

export interface VisionVariable {
  id: string;
  positions: string[];
  encoding: Record<string, number>;
  weight: number;
  description: string;
}

export interface ViolationSanityConfig {
  variables: ViolationVariable[];
  prompt: string;
  scoringWeights: Record<string, number>;
  thresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export interface ViolationVariable {
  id: string;
  description: string;
  scale: [number, number];
  weight: number;
}

export interface DataSourceConfig {
  sources: DataSource[];
  refreshIntervals: Record<string, number>;
  cacheSettings: CacheConfig;
}

export interface DataSource {
  id: string;
  type: 'camera' | 'weather' | 'traffic' | 'historical';
  endpoint: string;
  apiKey?: string;
  enabled: boolean;
}

export interface CacheConfig {
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'fifo';
}

export interface OrchestrationConfig {
  agent: {
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
  };
  reporting: {
    intervals: ReportingInterval[];
    metrics: string[];
  };
  audit: {
    frequency: string; // cron expression
    checks: AuditCheck[];
  };
}

export interface ReportingInterval {
  name: string;
  cron: string;
  reportType: 'session' | 'daily' | 'weekly' | 'monthly';
}

export interface AuditCheck {
  id: string;
  description: string;
  frequency: string;
  type: 'config' | 'performance' | 'accuracy' | 'compliance';
}

// Analysis results
export interface VibeCheckAnalysis {
  id: string;
  timestamp: number;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  visionResults: VisionAnalysisResult;
  violationResults?: ViolationAnalysisResult;
  safetyScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  recommendations: string[];
  metadata: AnalysisMetadata;
}

export interface VisionAnalysisResult {
  rawData: Record<string, number>;
  interpretedMetrics: {
    activeCycling: number;
    pedestrianSafety: number;
    trafficPressure: number;
    infrastructureQuality: number;
  };
  contextualFactors: {
    timeOfDay: string;
    weather: string;
    visibility: string;
  };
}

export interface ViolationAnalysisResult {
  violationType: string;
  severity: number;
  evidence: string[];
  report311: string;
  actionRequired: boolean;
}

export interface AnalysisMetadata {
  processingTime: number;
  modelVersions: Record<string, string>;
  confidence: number;
  source: string;
  territory?: string;
}

// Agent communication
export interface AgentMessage {
  id: string;
  timestamp: number;
  type: 'config-update' | 'analysis-request' | 'report' | 'audit' | 'error';
  payload: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface AgentState {
  id: string;
  status: 'idle' | 'processing' | 'error' | 'offline';
  lastActivity: number;
  currentTasks: string[];
  capabilities: string[];
  metrics: AgentMetrics;
}

export interface AgentMetrics {
  totalAnalyses: number;
  successRate: number;
  avgProcessingTime: number;
  errorCount: number;
  configChanges: number;
} 