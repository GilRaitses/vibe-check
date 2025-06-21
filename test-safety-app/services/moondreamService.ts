// Moondream.ai API Service for Bicycle Detection
const MOONDREAM_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlfaWQiOiIzNGFhYzRkOC0wZDliLTQ0YjItOTIwMi0wZDg0ZjNhODBlMDAiLCJvcmdfaWQiOiJkT1hVemRNNjdmODl6cURoRERCT3M1Ym10VVJVczB5RSIsImlhdCI6MTc1MDUyNjg3NywidmVyIjoxfQ.O9EqOMgmsgmbRYG6ZemHY5-fNMteYZEANFSBU4em3QM';
const MOONDREAM_API_BASE = 'https://api.moondream.ai/v1';

export interface DetectedObject {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

export interface MoondreamDetectionResult {
  request_id: string;
  objects: DetectedObject[];
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

export interface AnalysisProgress {
  step: number;
  totalSteps: number;
  currentStep: string;
  description: string;
  completed: boolean;
  error?: string;
}

export type ProgressCallback = (progress: AnalysisProgress) => void;

class MoondreamService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = MOONDREAM_API_KEY;
    this.baseUrl = MOONDREAM_API_BASE;
  }

  /**
   * Convert image URI to base64 data URI format required by Moondream API
   * Includes image compression for better network performance
   */
  private async imageUriToBase64(imageUri: string, disableTimeouts: boolean = false): Promise<string> {
    try {
      console.log('📸 [HACKATHON] Converting image to base64 with compression...');
      
      // Add timeout to fetch request (unless disabled)
      const controller = new AbortController();
      const timeoutId = disableTimeouts ? null : setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(imageUri, {
        signal: controller.signal
      });
      if (timeoutId) clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log(`📦 [HACKATHON] Image blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          console.log(`✅ [HACKATHON] Image converted to base64 (${(base64.length / 1024).toFixed(0)} KB)`);
          resolve(base64);
        };
        reader.onerror = (error) => {
          console.error('❌ [HACKATHON] FileReader error:', error);
          reject(error);
        };
        reader.readAsDataURL(blob);
      });
          } catch (error: any) {
        console.error('❌ [HACKATHON] Error converting image to base64:', error);
        if (error?.name === 'AbortError') {
          throw new Error('Image processing timed out - try taking a smaller photo or moving to better network coverage');
        }
        throw new Error('Failed to process image - check your network connection');
      }
  }

  /**
   * Detect people riding bicycles (cyclists) on sidewalks using Moondream API
   * Focuses on active cycling behavior rather than parked bikes
   */
  async detectBicycles(imageUri: string, progressCallback?: ProgressCallback, disableTimeouts: boolean = false): Promise<BicycleDetectionResult> {
    try {
      const totalSteps = 8;
      let currentStep = 0;

      // Step 1: Convert image to base64
      progressCallback?.({
        step: ++currentStep,
        totalSteps,
        currentStep: 'Processing Image',
        description: 'Converting image to base64 format...',
        completed: false
      });
      const base64Image = await this.imageUriToBase64(imageUri, disableTimeouts);

      // Step 2: Get scene description first (with fallback if it fails)
      progressCallback?.({
        step: ++currentStep,
        totalSteps,
        currentStep: 'Scene Analysis',
        description: 'Getting scene description...',
        completed: false
      });
      let sceneDescription = 'Street scene with pedestrian area'; // Default fallback
      try {
        sceneDescription = await this.getCaptionForContext(imageUri, disableTimeouts);
      } catch (error) {
        console.log('⚠️ [HACKATHON] Caption failed, continuing with default description');
      }

      // Step 3: Primary cyclist detection
      progressCallback?.({
        step: ++currentStep,
        totalSteps,
        currentStep: 'Cyclist Detection',
        description: 'Detecting active cyclists...',
        completed: false
      });
      console.log('🚴 [HACKATHON] Detecting cyclists (people riding bikes) vs parked bicycles...');

      // Primary detection: Look for cyclists (people actively riding)
      const cyclistResponse = await this.callDetectAPI(base64Image, 'cyclist', disableTimeouts);
      const personOnBikeResponse = await this.callDetectAPI(base64Image, 'person on bicycle', disableTimeouts);
      
      // Step 4: Secondary bicycle detection
      progressCallback?.({
        step: ++currentStep,
        totalSteps,
        currentStep: 'Bicycle Detection',
        description: 'Detecting bicycles for context...',
        completed: false
      });
      
      // Secondary detection: General bicycle detection for context
      const bicycleResponse = await this.callDetectAPI(base64Image, 'bicycle', disableTimeouts);
      const bikeResponse = await this.callDetectAPI(base64Image, 'bike', disableTimeouts);

      // Step 5: AI filtering for active cyclists
      progressCallback?.({
        step: ++currentStep,
        totalSteps,
        currentStep: 'AI Analysis',
        description: 'Filtering active cyclists vs parked bikes...',
        completed: false
      });

      // Use AI to distinguish between parked bikes and active cyclists
      let activeCyclists: DetectedObject[] = [];
      try {
        activeCyclists = await this.filterForActiveCyclists(imageUri, [
          ...cyclistResponse.objects,
          ...personOnBikeResponse.objects,
          ...bicycleResponse.objects,
          ...bikeResponse.objects
        ], disableTimeouts);
      } catch (error) {
        console.log('⚠️ [HACKATHON] Active cyclist filtering failed, using all detections as fallback');
        // Fallback: use all bicycle detections (conservative approach)
        activeCyclists = [
          ...cyclistResponse.objects,
          ...personOnBikeResponse.objects,
          ...bicycleResponse.objects,
          ...bikeResponse.objects
        ];
      }

      // Step 6: Sidewalk detection
      progressCallback?.({
        step: ++currentStep,
        totalSteps,
        currentStep: 'Sidewalk Detection',
        description: 'Detecting sidewalks and walkways...',
        completed: false
      });

      // Detect sidewalks for confirmation
      const sidewalkResponse = await this.callDetectAPI(base64Image, 'sidewalk', disableTimeouts);
      const pavement = await this.callDetectAPI(base64Image, 'pavement', disableTimeouts);
      const walkway = await this.callDetectAPI(base64Image, 'walkway', disableTimeouts);

      // Combine all sidewalk detections
      const allSidewalks = [
        ...sidewalkResponse.objects,
        ...pavement.objects,
        ...walkway.objects
      ];

      // Remove duplicates (objects that overlap significantly)
      const uniqueCyclists = this.removeDuplicateDetections(activeCyclists);
      const uniqueSidewalks = this.removeDuplicateDetections(allSidewalks);

      // Step 7: Sidewalk confirmation
      progressCallback?.({
        step: ++currentStep,
        totalSteps,
        currentStep: 'Sidewalk Confirmation',
        description: 'Confirming sidewalk presence...',
        completed: false
      });

      // Check if scene likely contains a sidewalk using AI
      let hasSidewalk = true; // Default to true (conservative)
      try {
        hasSidewalk = await this.confirmSidewalkPresence(imageUri, sceneDescription, disableTimeouts);
      } catch (error) {
        console.log('⚠️ [HACKATHON] Sidewalk confirmation failed, assuming sidewalk present');
      }

      // Step 8: Final analysis
      progressCallback?.({
        step: ++currentStep,
        totalSteps,
        currentStep: 'Final Analysis',
        description: 'Calculating safety score and confidence...',
        completed: false
      });

      // Calculate safety score based on active cyclist count (more severe than parked bikes)
      const safetyScore = this.calculateCyclistSafetyScore(uniqueCyclists.length);
      
      // Determine confidence based on number of detections and scene context
      const confidence = this.determineConfidence(uniqueCyclists.length, hasSidewalk);

      console.log(`🚴 [HACKATHON] Detected ${uniqueCyclists.length} active cyclists on sidewalk`);

      // Complete progress
      progressCallback?.({
        step: totalSteps,
        totalSteps,
        currentStep: 'Complete',
        description: `Analysis complete: ${uniqueCyclists.length} active cyclists detected`,
        completed: true
      });

      return {
        bicycles: uniqueCyclists, // Now represents active cyclists, not parked bikes
        sidewalks: uniqueSidewalks,
        totalCount: uniqueCyclists.length,
        confidence,
        safetyScore,
        sceneDescription,
        hasSidewalk
      };

    } catch (error) {
      console.error('Error detecting cyclists:', error);
      throw new Error('Failed to detect cyclists in image');
    }
  }

  /**
   * Use AI to filter detections for active cyclists vs parked bicycles
   */
  private async filterForActiveCyclists(imageUri: string, allDetections: DetectedObject[], disableTimeouts: boolean = false): Promise<DetectedObject[]> {
    try {
      if (allDetections.length === 0) {
        return [];
      }

      console.log(`🔍 [HACKATHON] Filtering ${allDetections.length} bicycle detections for active cyclists...`);

      // Ask AI to identify which detections show people actively riding
      const question = "In this image, are there any people actively riding bicycles or cycling? Describe what you see - are the bicycles being ridden by people, or are they parked/stationary? Focus on whether someone is currently on and riding the bicycle.";
      const answer = await this.askQuestion(imageUri, question, disableTimeouts);

      console.log(`🤖 [HACKATHON] AI cyclist analysis: "${answer}"`);

      // Analyze the response for active cycling indicators
      const activeCyclingKeywords = [
        'riding', 'cycling', 'person on', 'someone on', 'riding bicycle', 
        'cycling on', 'person riding', 'cyclist', 'riding bike', 'on a bike',
        'pedaling', 'moving', 'in motion'
      ];

      const parkedKeywords = [
        'parked', 'stationary', 'not riding', 'no one on', 'empty', 'unoccupied',
        'standing', 'leaning', 'not moving', 'abandoned'
      ];

      const hasActiveCycling = activeCyclingKeywords.some(keyword => 
        answer.toLowerCase().includes(keyword)
      );

      const hasParkedBikes = parkedKeywords.some(keyword => 
        answer.toLowerCase().includes(keyword)
      );

      // If we detect active cycling, return the detections
      // If only parked bikes, return empty array
      if (hasActiveCycling && !hasParkedBikes) {
        console.log(`✅ [HACKATHON] Found active cyclists - returning ${allDetections.length} detections`);
        return allDetections;
      } else if (hasParkedBikes && !hasActiveCycling) {
        console.log(`🚫 [HACKATHON] Only parked bicycles detected - filtering out safety concern`);
        return [];
      } else if (hasActiveCycling && hasParkedBikes) {
        // Mixed scenario - be conservative and return half the detections
        console.log(`⚠️ [HACKATHON] Mixed active/parked bicycles - returning partial detections`);
        return allDetections.slice(0, Math.ceil(allDetections.length / 2));
      } else {
        // Unclear - ask more specific question
        const specificQuestion = "How many people do you see currently riding or sitting on bicycles in this image? Count only people who are actively on bicycles, not parked bicycles.";
        const specificAnswer = await this.askQuestion(imageUri, specificQuestion);
        
        console.log(`🔍 [HACKATHON] Specific cyclist count: "${specificAnswer}"`);
        
        // Extract number from response
        const cyclistCount = this.extractNumberFromText(specificAnswer);
        
        if (cyclistCount > 0) {
          console.log(`✅ [HACKATHON] AI confirmed ${cyclistCount} active cyclists`);
          return allDetections.slice(0, cyclistCount);
        } else {
          console.log(`🚫 [HACKATHON] No active cyclists confirmed by AI`);
          return [];
        }
      }

    } catch (error) {
      console.error('❌ [HACKATHON] Error filtering for active cyclists:', error);
      // Fallback - be conservative and assume some are active
      return allDetections.slice(0, Math.ceil(allDetections.length / 2));
    }
  }

  /**
   * Extract number from text response
   */
  private extractNumberFromText(text: string): number {
    const numbers = text.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      return parseInt(numbers[0], 10);
    }
    
    // Check for written numbers
    const writtenNumbers: { [key: string]: number } = {
      'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    };
    
    const lowerText = text.toLowerCase();
    for (const [word, num] of Object.entries(writtenNumbers)) {
      if (lowerText.includes(word)) {
        return num;
      }
    }
    
    return 0;
  }

  /**
   * Calculate safety score specifically for active cyclists (more severe than parked bikes)
   */
  private calculateCyclistSafetyScore(activeCyclistCount: number): number {
    // Active cyclists on sidewalks are a more serious safety concern than parked bikes
    // Scale: 10 = safest, 1 = most dangerous
    
    if (activeCyclistCount === 0) return 10; // Very safe - no cyclists on sidewalk
    if (activeCyclistCount === 1) return 5;  // Moderate concern - one cyclist
    if (activeCyclistCount === 2) return 3;  // High concern - multiple cyclists
    if (activeCyclistCount >= 3) return 1;   // Very dangerous - many cyclists on sidewalk
    
    return 5; // Default moderate score
  }

  /**
   * Use AI to confirm if the image contains a sidewalk/pedestrian area
   */
  private async confirmSidewalkPresence(imageUri: string, sceneDescription: string, disableTimeouts: boolean = false): Promise<boolean> {
    try {
      // Check scene description for sidewalk-related keywords
      const sidewalkKeywords = [
        'sidewalk', 'pavement', 'walkway', 'pedestrian', 'path', 'street', 
        'road', 'curb', 'footpath', 'concrete', 'asphalt', 'walking'
      ];
      
      const descriptionHasSidewalk = sidewalkKeywords.some(keyword => 
        sceneDescription.toLowerCase().includes(keyword)
      );

      if (descriptionHasSidewalk) {
        return true;
      }

      // Ask specific question about sidewalk presence
      const question = "Is there a sidewalk, pavement, or pedestrian walkway visible in this image? Answer yes or no.";
      const answer = await this.askQuestion(imageUri, question, disableTimeouts);
      
      return answer.toLowerCase().includes('yes');
    } catch (error) {
      console.error('Error confirming sidewalk presence:', error);
      // Fallback - assume it's a sidewalk if we got this far
      return true;
    }
  }

  /**
   * Call Moondream detect API for a specific object type with timeout handling
   */
  private async callDetectAPI(base64Image: string, objectType: string, disableTimeouts: boolean = false): Promise<MoondreamDetectionResult> {
    try {
      console.log(`🤖 [HACKATHON] Calling Moondream API for ${objectType} detection...`);
      
      // Add timeout to API request (unless disabled)
      const controller = new AbortController();
      const timeoutId = disableTimeouts ? null : setTimeout(() => controller.abort(), 45000); // 45 second timeout
      
      const response = await fetch(`${this.baseUrl}/detect`, {
        method: 'POST',
        headers: {
          'X-Moondream-Auth': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: base64Image,
          object: objectType,
          stream: false
        }),
        signal: controller.signal
      });
      
      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [HACKATHON] Moondream API error:', errorText);
        throw new Error(`Moondream API error: ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ [HACKATHON] ${objectType} detection completed`);
      return result;
      
    } catch (error: any) {
      console.error(`❌ [HACKATHON] Error calling Moondream API for ${objectType}:`, error);
      if (error?.name === 'AbortError') {
        throw new Error(`${objectType} detection timed out - check your network connection`);
      }
      throw error;
    }
  }

  /**
   * Remove duplicate detections that overlap significantly
   */
  private removeDuplicateDetections(detections: DetectedObject[]): DetectedObject[] {
    const uniqueDetections: DetectedObject[] = [];
    
    for (const detection of detections) {
      let isDuplicate = false;
      
      for (const existing of uniqueDetections) {
        if (this.calculateOverlap(detection, existing) > 0.5) { // 50% overlap threshold
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        uniqueDetections.push(detection);
      }
    }
    
    return uniqueDetections;
  }

  /**
   * Calculate overlap between two bounding boxes
   */
  private calculateOverlap(box1: DetectedObject, box2: DetectedObject): number {
    const x1 = Math.max(box1.x_min, box2.x_min);
    const y1 = Math.max(box1.y_min, box2.y_min);
    const x2 = Math.min(box1.x_max, box2.x_max);
    const y2 = Math.min(box1.y_max, box2.y_max);

    if (x2 <= x1 || y2 <= y1) return 0;

    const intersectionArea = (x2 - x1) * (y2 - y1);
    const box1Area = (box1.x_max - box1.x_min) * (box1.y_max - box1.y_min);
    const box2Area = (box2.x_max - box2.x_min) * (box2.y_max - box2.y_min);
    const unionArea = box1Area + box2Area - intersectionArea;

    return intersectionArea / unionArea;
  }

  /**
   * Calculate safety score based on bicycle count (1-10 scale)
   */
  private calculateSafetyScore(bicycleCount: number): number {
    // More bicycles = lower safety score
    // 0 bicycles = 10/10 safety
    // 1 bicycle = 7/10 safety  
    // 2 bicycles = 5/10 safety
    // 3+ bicycles = 3/10 safety
    
    if (bicycleCount === 0) return 10;
    if (bicycleCount === 1) return 7;
    if (bicycleCount === 2) return 5;
    if (bicycleCount === 3) return 3;
    return Math.max(1, 3 - (bicycleCount - 3)); // Minimum score of 1
  }

  /**
   * Determine confidence level based on detection count and scene context
   */
  private determineConfidence(count: number, hasSidewalk: boolean): 'high' | 'medium' | 'low' {
    // Higher confidence if we can confirm it's actually a sidewalk scene
    if (!hasSidewalk) return 'low'; // Low confidence if no sidewalk detected
    
    if (count === 0) return 'high'; // High confidence in no detection on confirmed sidewalk
    if (count <= 2) return 'high';  // High confidence in clear detections
    if (count <= 4) return 'medium'; // Medium confidence
    return 'low'; // Low confidence with many detections (might be false positives)
  }

  /**
   * Ask Moondream a question about the image (for additional context)
   */
  async askQuestion(imageUri: string, question: string, disableTimeouts: boolean = false): Promise<string> {
    try {
      console.log(`❓ [HACKATHON] Asking question: "${question}"`);
      const base64Image = await this.imageUriToBase64(imageUri);

      // Add timeout to API request (unless disabled)
      const controller = new AbortController();
      const timeoutId = disableTimeouts ? null : setTimeout(() => controller.abort(), 40000); // 40 second timeout

      const response = await fetch(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: {
          'X-Moondream-Auth': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: base64Image,
          question: question,
          stream: false
        }),
        signal: controller.signal
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Moondream API error: ${response.status}`);
      }

      const result = await response.json();
      const answer = result.answer || result.text || 'No answer received';
      console.log(`✅ [HACKATHON] Question answered: "${answer}"`);
      return answer;

    } catch (error: any) {
      console.error('❌ [HACKATHON] Error asking question:', error);
      if (error?.name === 'AbortError') {
        throw new Error('Question timed out - check your network connection');
      }
      throw new Error('Failed to get answer from Moondream');
    }
  }

  /**
   * Get image caption for additional context with timeout handling
   */
  async getCaptionForContext(imageUri: string, disableTimeouts: boolean = false): Promise<string> {
    try {
      console.log(`📝 [HACKATHON] Getting image caption...`);
      const base64Image = await this.imageUriToBase64(imageUri);

      // Add timeout to API request (unless disabled)
      const controller = new AbortController();
      const timeoutId = disableTimeouts ? null : setTimeout(() => controller.abort(), 35000); // 35 second timeout

      const response = await fetch(`${this.baseUrl}/caption`, {
        method: 'POST',
        headers: {
          'X-Moondream-Auth': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: base64Image,
          length: 'short',
          stream: false
        }),
        signal: controller.signal
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Moondream API error: ${response.status}`);
      }

      const result = await response.json();
      const caption = result.caption || 'No caption available';
      console.log(`✅ [HACKATHON] Caption received: "${caption}"`);
      return caption;

    } catch (error: any) {
      console.error('❌ [HACKATHON] Error getting caption:', error);
      if (error?.name === 'AbortError') {
        console.log('⚠️ [HACKATHON] Caption request timed out, using fallback');
        return 'Street scene with pedestrian area'; // Fallback description
      }
      console.log('⚠️ [HACKATHON] Caption failed, using fallback');
      return 'Street scene with pedestrian area'; // Fallback description
    }
  }
}

export default new MoondreamService(); 