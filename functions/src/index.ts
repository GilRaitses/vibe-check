import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as cors from 'cors';
import * as express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { Request, Response } from 'express';
import * as path from 'path';

admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

// Initialize Google Cloud Vision
const visionClient = new ImageAnnotatorClient({
  keyFilename: path.join(__dirname, '../service-account-key.json')
});

// Firestore references
const db = admin.firestore();

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    timestamp: Date.now(),
    version: '1.0.0'
  });
});

/**
 * Orchestrate Analysis - Main AI endpoint
 */
app.post('/orchestrate-analysis', async (req: Request, res: Response) => {
  try {
    const { imageData, metadata } = req.body;
    
    if (!imageData || !metadata) {
      return res.status(400).json({
        error: 'Missing required fields: imageData, metadata'
      });
    }

    // Generate analysis using Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const analysisPrompt = `
As the vibe-check AI orchestrator, analyze this street scene for pedestrian safety:

Location: ${JSON.stringify(metadata.location)}
Context: ${JSON.stringify(metadata)}

Please provide:
1. Safety score (0-10)
2. Risk level (low/moderate/high/critical)
3. Specific hazards identified
4. Recommendations for pedestrians
5. Infrastructure observations

Respond with JSON:
{
  "safetyScore": number,
  "riskLevel": "low|moderate|high|critical",
  "hazards": ["string"],
  "recommendations": ["string"],
  "infrastructure": {
    "bikeActivity": "low|medium|high",
    "pedestrianSpace": "adequate|crowded|blocked",
    "visibility": "good|fair|poor"
  },
  "confidence": number
}`;

    const result = await model.generateContent([
      analysisPrompt,
      {
        inlineData: {
          data: imageData,
          mimeType: 'image/jpeg'
        }
      }
    ]);

    const response = result.response.text();
    const analysis = JSON.parse(response);

    // Store analysis in Firestore
    const analysisDoc = {
      id: `analysis-${Date.now()}`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      location: metadata.location,
      analysis,
      metadata
    };

    await db.collection('analyses').add(analysisDoc);

    res.json({
      success: true,
      analysis: {
        ...analysisDoc,
        timestamp: Date.now()
      }
    });

  } catch (error) {
    console.error('Analysis failed:', error);
    res.status(500).json({
      error: 'Analysis failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Submit User Report
 */
app.post('/submit-report', async (req: Request, res: Response) => {
  try {
    const { location, reportType, description, severity, imageData } = req.body;

    if (!location || !reportType) {
      return res.status(400).json({
        error: 'Missing required fields: location, reportType'
      });
    }

    const report: any = {
      id: `report-${Date.now()}`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      location,
      reportType,
      description: description || '',
      severity: severity || 'medium',
      status: 'pending',
      hasImage: !!imageData
    };

    // Store image separately if provided
    if (imageData) {
      const bucket = admin.storage().bucket();
      const filename = `reports/${report.id}.jpg`;
      const file = bucket.file(filename);
      
      await file.save(Buffer.from(imageData, 'base64'), {
        metadata: {
          contentType: 'image/jpeg'
        }
      });
      
      report.imageUrl = filename;
    }

    await db.collection('reports').add(report);

    res.json({
      success: true,
      reportId: report.id,
      message: 'Report submitted successfully'
    });

  } catch (error) {
    console.error('Report submission failed:', error);
    res.status(500).json({
      error: 'Report submission failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get Territory Analysis
 */
app.get('/territory/:territoryId', async (req: Request, res: Response) => {
  try {
    const { territoryId } = req.params;
    
    // Get recent analyses for this territory
    const analysesSnapshot = await db.collection('analyses')
      .where('metadata.territory', '==', territoryId)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const analyses = analysesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any));

    // Get reports for this territory
    const reportsSnapshot = await db.collection('reports')
      .where('location.territory', '==', territoryId)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const reports = reportsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Calculate territory safety score
    const avgSafetyScore = analyses.length > 0 
      ? analyses.reduce((sum, a) => sum + (a.analysis?.safetyScore || 5), 0) / analyses.length
      : 5;

    res.json({
      territoryId,
      safetyScore: avgSafetyScore,
      totalAnalyses: analyses.length,
      totalReports: reports.length,
      recentAnalyses: analyses.slice(0, 5),
      recentReports: reports.slice(0, 5),
      lastUpdated: Date.now()
    });

  } catch (error) {
    console.error('Territory lookup failed:', error);
    res.status(500).json({
      error: 'Territory lookup failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Enhanced Analysis - Combines Google Vision + Gemini AI
 */
app.post('/enhanced-analysis', async (req: Request, res: Response) => {
  try {
    const { imageData, metadata } = req.body;
    
    if (!imageData || !metadata) {
      return res.status(400).json({
        error: 'Missing required fields: imageData, metadata'
      });
    }

    // Step 1: Use Google Cloud Vision for object detection
    const imageBuffer = Buffer.from(imageData, 'base64');
    const [visionResult] = await visionClient.annotateImage({
      image: { content: imageBuffer },
      features: [
        { type: 'OBJECT_LOCALIZATION', maxResults: 20 },
        { type: 'LABEL_DETECTION', maxResults: 10 },
        { type: 'SAFE_SEARCH_DETECTION' }
      ]
    });

    // Extract relevant objects for safety analysis
    const objects = visionResult.localizedObjectAnnotations || [];
    const labels = visionResult.labelAnnotations || [];
    const safeSearch = visionResult.safeSearchAnnotation;

    const detectedObjects = objects.map(obj => ({
      name: obj.name,
      confidence: obj.score,
      bounds: obj.boundingPoly
    }));

    const detectedLabels = labels.map(label => ({
      description: label.description,
      confidence: label.score
    }));

    // Step 2: Use Gemini AI for contextual analysis with Vision data
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const enhancedPrompt = `
As the vibe-check AI orchestrator, analyze this street scene using both visual data and contextual AI:

Location: ${JSON.stringify(metadata.location)}
Context: ${JSON.stringify(metadata)}

Google Vision detected objects: ${JSON.stringify(detectedObjects)}
Google Vision detected labels: ${JSON.stringify(detectedLabels)}

Based on both the image and the detected objects/labels, provide:
1. Safety score (0-10) considering detected hazards
2. Risk level (low/moderate/high/critical)
3. Specific hazards identified (including detected vehicles, cyclists, pedestrians)
4. Recommendations for pedestrians
5. Infrastructure observations
6. Object-specific risks (e.g., if bicycles detected on sidewalk)

Respond with JSON:
{
  "safetyScore": number,
  "riskLevel": "low|moderate|high|critical",
  "hazards": ["string"],
  "recommendations": ["string"],
  "infrastructure": {
    "bikeActivity": "low|medium|high",
    "pedestrianSpace": "adequate|crowded|blocked",
    "visibility": "good|fair|poor"
  },
  "detectedObjects": {
    "vehicles": number,
    "bicycles": number,
    "pedestrians": number,
    "otherHazards": ["string"]
  },
  "confidence": number
}`;

    const result = await model.generateContent([
      enhancedPrompt,
      {
        inlineData: {
          data: imageData,
          mimeType: 'image/jpeg'
        }
      }
    ]);

    const response = result.response.text();
    const analysis = JSON.parse(response);

    // Store enhanced analysis in Firestore
    const analysisDoc = {
      id: `enhanced-analysis-${Date.now()}`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      location: metadata.location,
      analysis,
      visionData: {
        objects: detectedObjects,
        labels: detectedLabels,
        safeSearch
      },
      metadata,
      type: 'enhanced'
    };

    await db.collection('analyses').add(analysisDoc);

    res.json({
      success: true,
      analysis: {
        ...analysisDoc,
        timestamp: Date.now()
      }
    });

  } catch (error: any) {
    console.error('Enhanced analysis failed:', error);
    res.status(500).json({
      error: 'Enhanced analysis failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get System Status
 */
app.get('/status', async (req, res) => {
  try {
    // Get system metrics
    const analysesSnapshot = await db.collection('analyses')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const reportsSnapshot = await db.collection('reports')
      .where('status', '==', 'pending')
      .get();

    const totalAnalyses = analysesSnapshot.size;
    const pendingReports = reportsSnapshot.size;
    
    // Calculate success rate (simplified)
    const successfulAnalyses = analysesSnapshot.docs.filter(doc => 
      doc.data().analysis?.safetyScore !== undefined
    ).length;
    
    const successRate = totalAnalyses > 0 ? successfulAnalyses / totalAnalyses : 1;

    res.json({
      status: 'operational',
      metrics: {
        totalAnalyses,
        pendingReports,
        successRate,
        avgResponseTime: '2.3s', // TODO: Calculate actual
        systemHealth: 'good'
      },
      services: {
        geminiAI: 'operational',
        firestore: 'operational',
        storage: 'operational'
      },
      lastUpdated: Date.now()
    });

  } catch (error: any) {
    console.error('Status check failed:', error);
    res.status(500).json({
      error: 'Status check failed',
      details: error.message
    });
  }
});

// Export the API as Firebase Cloud Function
export const api = functions.https.onRequest(app);

// Scheduled function for daily reports
export const dailyReport = functions.pubsub.schedule('0 9 * * *')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log('Generating daily safety report...');
    
    try {
      // Get yesterday's analyses
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const analysesSnapshot = await db.collection('analyses')
        .where('timestamp', '>=', yesterday)
        .get();

      const analyses = analysesSnapshot.docs.map(doc => doc.data());
      
      // Generate report with Gemini
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const reportPrompt = `
Generate a daily safety report for NYC pedestrian conditions:

Data: ${JSON.stringify(analyses)}

Provide:
1. Overall safety trends
2. High-risk areas identified
3. Most common issues
4. Recommendations for city planning
5. Statistical summary

Format as a comprehensive daily report.`;

      const result = await model.generateContent(reportPrompt);
      const report = result.response.text();

      // Store report
      await db.collection('daily-reports').add({
        date: yesterday.toISOString().split('T')[0],
        report,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        analysisCount: analyses.length
      });

      console.log('Daily report generated successfully');
      return null;
    } catch (error: any) {
      console.error('Daily report generation failed:', error);
      return null;
    }
  }); 