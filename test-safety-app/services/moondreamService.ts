// Moondream.ai API Service - PURE VISION ANALYSIS ONLY
// Returns only encoded numerical data (0-4) - no interpretation, no external data
// All downstream processing handled by other services reading from AsyncStorage

import { VISION_CONFIG, RawVisionResponse, validateVisionResponse, generateVisionKeys } from '../config/visionConfig';
import { SIDEWALK_VIOLATION_PROMPT, parseSidewalkViolationResponse, calculateViolationScore, SidewalkViolationMatrix } from '../config/sidewalkViolationConfig';

// Legacy interfaces for camera compatibility
export interface DetectedObject {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label: string;
}

export interface BicycleDetectionResult {
  bicycles: DetectedObject[];
  sidewalks: DetectedObject[];
  totalCount: number;
  confidence: 'high' | 'medium' | 'low';
  safetyScore: number;
  sceneDescription: string;
  hasSidewalk: boolean;
}

const MOONDREAM_API_KEY = process.env.EXPO_PUBLIC_MOONDREAM_API_KEY || 'hyper-panther-270';
const MOONDREAM_API_BASE = 'https://api.moondream.ai/v1';

class MoondreamService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = MOONDREAM_API_KEY;
    this.baseUrl = MOONDREAM_API_BASE;
  }

    /**
   * BICYCLE DETECTION - Dedicated method for manual camera feature
   * Uses specific bicycle detection prompt optimized for camera photos
   */
  async detectBicycles(imageUri: string): Promise<BicycleDetectionResult> {
    console.log('🚴‍♀️ [MOONDREAM] Bicycle detection for camera...');
    
    try {
      const base64Image = await this.imageUriToBase64(imageUri);
      const response = await this.callBicycleDetectionAPI(base64Image);
      
      console.log('✅ [MOONDREAM] Bicycle detection completed:', response);
      return response;
      
    } catch (error) {
      console.error('❌ [MOONDREAM] Bicycle detection failed:', error);
      throw error;
    }
  }

  /**
   * Call bicycle detection API with 13-variable sidewalk violation config
   */
  private async callBicycleDetectionAPI(base64Image: string): Promise<BicycleDetectionResult> {
    console.log('🔢 [MOONDREAM] Using 13-variable sidewalk violation config for camera...');
    
    const requestBody = {
      image: base64Image,
      question: SIDEWALK_VIOLATION_PROMPT,
      response_format: 'text'
    };

    const response = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: {
        'X-Moondream-Auth': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Moondream API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('🔢 [MOONDREAM] Raw 13-variable response:', result.answer);
    
    // STORE RAW NUMERICAL DATA IN ASYNCSTORAGE
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const timestamp = new Date().toISOString();
      const rawData = {
        rawResponse: result.answer,
        timestamp,
        type: '13-variable-sidewalk',
        imageUri: 'user-camera-photo'
      };
      
      await AsyncStorage.setItem(`sidewalk_analysis_${Date.now()}`, JSON.stringify(rawData));
      console.log('💾 [MOONDREAM] Raw 13-variable data stored in AsyncStorage:', result.answer);
    } catch (storageError) {
      console.error('❌ [MOONDREAM] Failed to store raw data in AsyncStorage:', storageError);
    }
    
    // Parse the 13-variable response
    let violationMatrix: SidewalkViolationMatrix;
    try {
      violationMatrix = parseSidewalkViolationResponse(result.answer);
      console.log('📋 [MOONDREAM] Parsed violation matrix:', violationMatrix);
    } catch (error) {
      console.error('❌ [MOONDREAM] Failed to parse 13-variable response:', error);
      throw new Error('Invalid 13-variable response format');
    }
    
    // Convert violation matrix to bicycle detection format
    const violationScore = calculateViolationScore(violationMatrix);
    // Use violation score to determine bicycle presence and confidence
    const bicycleCount = violationScore > 5 ? 1 : 0; // High violation score = bicycle present
    const hasSidewalk = true; // Always true for sidewalk violation analysis
    const confidence: 'high' | 'medium' | 'low' = violationScore > 7 ? 'high' : 
                      violationScore > 3 ? 'medium' : 'low';
    
    const sceneDescription = `Sidewalk analysis: ${confidence} confidence violation (score: ${violationScore.toFixed(1)}/10)`;
    
    console.log(`🎯 [MOONDREAM] Converted to bicycle detection: ${bicycleCount} cyclists, ${confidence} confidence`);
    
    // Create detected objects for UI overlay
    const bicycles: DetectedObject[] = [];
    for (let i = 0; i < bicycleCount; i++) {
      bicycles.push({
        x: 100 + (i * 50),
        y: 200 + (i * 30),
        width: 80,
        height: 120,
        confidence: confidence === 'high' ? 0.9 : confidence === 'medium' ? 0.7 : 0.5,
        label: 'bicycle'
      });
    }
    
    const sidewalks: DetectedObject[] = hasSidewalk ? [{
      x: 0,
      y: 300,
      width: 400,
      height: 100,
      confidence: 0.8,
      label: 'sidewalk'
    }] : [];
    
    // Calculate safety score
    let safetyScore = 10;
    if (bicycleCount === 1) safetyScore = 7;
    else if (bicycleCount === 2) safetyScore = 5;
    else if (bicycleCount === 3) safetyScore = 3;
    else if (bicycleCount > 3) safetyScore = Math.max(1, 3 - (bicycleCount - 3));
    
    return {
      bicycles,
      sidewalks,
      totalCount: bicycleCount,
      confidence: confidence as 'high' | 'medium' | 'low',
      safetyScore,
      sceneDescription,
      hasSidewalk
    };
  }

  /**
   * PURE VISION ANALYSIS - Returns only encoded numerical data (0-4)
   * Single API call with 25 encoded variables
   * NO interpretation, NO external data, NO complex logic
   */
  async analyzeVisionOptimized(imageUri: string): Promise<RawVisionResponse> {
    console.log('🔥 [MOONDREAM] Starting pure vision analysis (encoded numbers only)...');
    
    try {
      const base64Image = await this.imageUriToBase64(imageUri);
      const response = await this.callVisionAPI(base64Image);
      
      if (!validateVisionResponse(response)) {
        console.error('❌ [MOONDREAM] Invalid vision response structure:', response);
        throw new Error('Invalid vision analysis response');
      }
      
      console.log('✅ [MOONDREAM] Pure vision analysis completed');
      console.log('🔢 [MOONDREAM] Raw encoded data (25 variables):', JSON.stringify(response, null, 2));
      
      return response;
      
    } catch (error) {
      console.error('❌ [MOONDREAM] Vision analysis failed:', error);
      throw error;
    }
  }

  /**
   * Call vision API with config-based prompt
   */
  private async callVisionAPI(base64Image: string): Promise<RawVisionResponse> {
    const startTime = Date.now();
    
    const requestBody = {
      image: base64Image,
      question: VISION_CONFIG.prompt,
      response_format: VISION_CONFIG.responseFormat
    };

    console.log('🤖 [MOONDREAM] Making single API call for encoded vision data...');
    
    const response = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: {
        'X-Moondream-Auth': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [MOONDREAM] API Error:', response.status, errorText);
      throw new Error(`Moondream API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const apiTime = Date.now() - startTime;
    
    console.log(`⚡ [MOONDREAM] API call completed in ${apiTime}ms`);
    
    // Parse numerical array response and convert to JSON
    let parsedResponse: RawVisionResponse;
    try {
      let answerText = result.answer;
      
      // Remove any markdown formatting
      if (typeof answerText === 'string') {
        answerText = answerText.replace(/```.*?\n/g, '').replace(/```/g, '').trim();
      }
      
      console.log('🔢 [MOONDREAM] Raw numerical response:', answerText);
      
      // Parse the numerical array
      let numericalArray: number[];
      if (answerText.startsWith('[') && answerText.endsWith(']')) {
        numericalArray = JSON.parse(answerText);
      } else {
        // Handle case where response is just comma-separated numbers
        numericalArray = answerText.split(',').map((n: string) => parseInt(n.trim()));
      }
      
      if (numericalArray.length !== 25) {
        throw new Error(`Expected 25 numbers, got ${numericalArray.length}`);
      }
      
      // Convert array to named JSON object
      const keys = generateVisionKeys();
      parsedResponse = {} as RawVisionResponse;
      
      for (let i = 0; i < keys.length; i++) {
        (parsedResponse as any)[keys[i]] = numericalArray[i];
      }
      
      console.log('📋 [MOONDREAM] Converted to feature matrix:', JSON.stringify(parsedResponse, null, 2));
      
    } catch (parseError) {
      console.error('❌ [MOONDREAM] Failed to parse numerical response:', result.answer);
      throw new Error('Invalid numerical response from vision API');
    }
    
    return parsedResponse;
  }

  /**
   * Convert image URI to base64
   */
  private async imageUriToBase64(imageUri: string): Promise<string> {
    try {
      console.log('📸 [MOONDREAM] Converting image to base64...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(imageUri, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log(`📦 [MOONDREAM] Image blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          console.log(`✅ [MOONDREAM] Image converted to base64 (${(base64.length / 1024).toFixed(0)} KB)`);
          resolve(base64);
        };
        reader.onerror = (error) => {
          console.error('❌ [MOONDREAM] FileReader error:', error);
          reject(error);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('❌ [MOONDREAM] Image conversion failed:', error);
      throw error;
    }
  }
}

export default new MoondreamService(); 