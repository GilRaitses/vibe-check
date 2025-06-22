// Moondream.ai API Service - PURE VISION ANALYSIS ONLY
// Returns only encoded numerical data (0-4) - no interpretation, no external data
// All downstream processing handled by other services reading from AsyncStorage

import { VISION_CONFIG, RawVisionResponse, validateVisionResponse } from '../config/visionConfig';

const MOONDREAM_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlfaWQiOiIzNGFhYzRkOC0wZDliLTQ0YjItOTIwMi0wZDg0ZjNhODBlMDAiLCJvcmdfaWQiOiJkT1hVemRNNjdmODl6cURoRERCT3M1Ym10VVJVczB5RSIsImlhdCI6MTc1MDUyNjg3NywidmVyIjoxfQ.O9EqOMgmsgmbRYG6ZemHY5-fNMteYZEANFSBU4em3QM';
const MOONDREAM_API_BASE = 'https://api.moondream.ai/v1';

class MoondreamService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = MOONDREAM_API_KEY;
    this.baseUrl = MOONDREAM_API_BASE;
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
        'Authorization': `Bearer ${this.apiKey}`,
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
    
    // Parse JSON response
    let parsedResponse: RawVisionResponse;
    try {
      if (typeof result.answer === 'string') {
        parsedResponse = JSON.parse(result.answer);
      } else {
        parsedResponse = result.answer;
      }
    } catch (parseError) {
      console.error('❌ [MOONDREAM] Failed to parse JSON response:', result.answer);
      throw new Error('Invalid JSON response from vision API');
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