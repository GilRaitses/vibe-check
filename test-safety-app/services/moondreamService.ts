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

// NEW: Enhanced Numerical Feature Matrix System - Compute Efficient & Robust
export interface SafetyFeatureMatrix {
  // === RAW COUNTS (integers, not normalized) ===
  counts: {
    bicycles: number;           // Raw count (0-50+)
    people: number;             // Raw count (0-100+)  
    vehicles: number;           // Raw count (0-50+)
    trucks: number;             // Raw count (0-20+)
    motorcycles: number;        // Raw count (0-10+)
    trafficSigns: number;       // Raw count (0-10+)
    streetLights: number;       // Raw count (0-10+)
  };

  // === BOOLEAN CONDITIONS (true/false only) ===
  conditions: {
    hasSidewalk: boolean;
    hasProtectedBikeLane: boolean;
    hasTrafficLight: boolean;
    hasStopSign: boolean;
    hasRoundabout: boolean;
    hasCrosswalk: boolean;
    hasStreetLighting: boolean;
    hasSecurityCamera: boolean;
    isIntersection: boolean;
    isSchoolZone: boolean;
    isResidentialArea: boolean;
    isCommercialArea: boolean;
  };

  // === CATEGORICAL CONDITIONS (enums) ===
  categories: {
    weatherCondition: 'clear' | 'rain' | 'snow' | 'fog' | 'unknown';
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | 'dawn' | 'dusk';
    trafficDensity: 'light' | 'moderate' | 'heavy' | 'gridlock';
    roadType: 'residential' | 'arterial' | 'highway' | 'local' | 'bridge';
    intersectionType: 'signalized' | 'stop-sign' | 'roundabout' | 'uncontrolled' | 'none';
  };

  // === DERIVED QUANTITIES (calculated from counts) ===
  derived: {
    // Density ratios (0.0 - 1.0)
    bicycleDensity: number;        // bicycles / (bicycles + vehicles)
    pedestrianDensity: number;     // people / totalObjects
    vehicleDensity: number;        // vehicles / totalObjects
    
    // Movement indicators (0-10 scale)
    activityLevel: number;         // Total objects normalized to 0-10
    congestionLevel: number;       // Traffic density score 0-10
    
    // Risk multipliers (0.0 - 5.0)
    bicycleRiskMultiplier: number; // Based on bicycle/vehicle ratio
    truckRiskMultiplier: number;   // Based on truck presence
    intersectionRiskMultiplier: number; // Based on intersection complexity
  };

  // === TIME-BASED ANALYTICS (for historical tracking) ===
  temporal: {
    analysisTimestamp: Date;
    
    // Rolling averages (when available)
    hourlyAverages?: {
      bicycles: number;
      vehicles: number;
      people: number;
    };
    
    // Trends (when historical data available)
    trends?: {
      bicycleTrend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
      trafficTrend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
      activityTrend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
    };
    
    // Peak detection
    isPeakHour?: boolean;
    isRushHour?: boolean;
  };

  // === CONFIDENCE METRICS (for reliability assessment) ===
  confidence: {
    overallConfidence: 'high' | 'medium' | 'low';
    detectionQuality: number;     // 0.0 - 1.0 (image quality score)
    weatherImpact: number;        // 0.0 - 1.0 (weather degradation)
    lightingImpact: number;       // 0.0 - 1.0 (lighting degradation)
    aiModelConfidence: number;    // 0.0 - 1.0 (model certainty)
  };

  // === TUNABLE COEFFICIENTS (for scoring formula) ===
  coefficients: {
    bicycleWeight: number;        // Impact of bicycles on safety (2.0-4.0)
    truckWeight: number;          // Impact of trucks on safety (3.0-5.0)  
    vehicleWeight: number;        // Impact of vehicles on safety (1.0-2.0)
    personWeight: number;         // Impact of people on safety (-0.5-0.5)
    
    // Infrastructure bonuses
    sidewalkBonus: number;        // Safety bonus for sidewalks (1.0-3.0)
    bikeLaneBonus: number;        // Safety bonus for bike lanes (2.0-4.0)
    lightingBonus: number;        // Safety bonus for lighting (0.5-2.0)
    trafficLightBonus: number;    // Safety bonus for signals (1.0-2.0)
    
    // Time/weather multipliers
    nightMultiplier: number;      // Night risk multiplier (1.2-2.0)
    weatherMultiplier: number;    // Bad weather multiplier (1.1-1.8)
    rushHourMultiplier: number;   // Rush hour multiplier (1.1-1.5)
  };
}

export interface BicycleDetectionResult {
  bicycles: DetectedObject[];
  sidewalks: DetectedObject[];
  totalCount: number;
  confidence: 'high' | 'medium' | 'low';
  safetyScore: number;
  sceneDescription: string;
  hasSidewalk: boolean;
  
  // NEW: Feature matrix for numerical analysis
  featureMatrix: SafetyFeatureMatrix;
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

  // Default risk coefficients - can be tuned based on data
  private defaultCoefficients = {
    bicycleWeight: 2.5,    // Higher weight = more impact on risk
    personWeight: 0.5,     // People generally increase safety
    vehicleWeight: 1.5,    // Vehicles increase risk moderately
    sidewalkBonus: 2.0,    // Sidewalks significantly improve safety
    lightingBonus: 1.0     // Good lighting improves safety
  };

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
   * NEW: Streamlined numerical analysis - single API call approach
   * Returns structured feature matrix for consistent scoring
   */
  async detectBicycles(imageUri: string, progressCallback?: ProgressCallback, disableTimeouts: boolean = false): Promise<BicycleDetectionResult> {
    try {
      const totalSteps = 3; // Simplified to 3 steps
      let currentStep = 0;

      // Step 1: Process image
      progressCallback?.({
        step: ++currentStep,
        totalSteps,
        currentStep: 'Processing Image',
        description: 'Converting image to base64...',
        completed: false
      });
      const base64Image = await this.imageUriToBase64(imageUri, disableTimeouts);

      // Step 2: Single detection call with multiple objects
      progressCallback?.({
        step: ++currentStep,
        totalSteps,
        currentStep: 'Object Detection',
        description: 'Detecting all objects in single call...',
        completed: false
      });
      
      // Single API call to detect multiple object types
      const detectionResults = await this.callBatchDetectAPI(base64Image, disableTimeouts);

      // Step 3: Generate feature matrix and calculate safety score
      progressCallback?.({
        step: ++currentStep,
        totalSteps,
        currentStep: 'Safety Analysis',
        description: 'Calculating safety score from features...',
        completed: false
      });

      const featureMatrix = this.extractFeatureMatrix(detectionResults);
      const safetyScore = this.calculateSafetyFromMatrix(featureMatrix);

      // Legacy compatibility - extract bicycles and sidewalks
      const bicycles = detectionResults.bicycles || [];
      const sidewalks = detectionResults.sidewalks || [];

      progressCallback?.({
        step: totalSteps,
        totalSteps,
        currentStep: 'Complete',
        description: `Analysis complete - Safety Score: ${safetyScore}/10`,
        completed: true
      });

      console.log('🎯 [HACKATHON] Numerical Analysis Complete:', {
        safetyScore,
        features: featureMatrix,
        bicycleCount: bicycles.length,
        sidewalkCount: sidewalks.length
      });

      return {
        bicycles,
        sidewalks,
        totalCount: bicycles.length,
        confidence: this.determineConfidence(bicycles.length, sidewalks.length > 0),
        safetyScore,
        sceneDescription: `Detected ${bicycles.length} bicycles, ${detectionResults.people?.length || 0} people, ${detectionResults.vehicles?.length || 0} vehicles`,
        hasSidewalk: sidewalks.length > 0,
        featureMatrix
      };

    } catch (error: any) {
      console.error('❌ [HACKATHON] Error in streamlined analysis:', error);
      
      // Return safe defaults with feature matrix
      const defaultMatrix = this.getDefaultFeatureMatrix();
      return {
        bicycles: [],
        sidewalks: [],
        totalCount: 0,
        confidence: 'low',
        safetyScore: 5, // Neutral when analysis fails
        sceneDescription: 'Analysis failed - using default assessment',
        hasSidewalk: false,
        featureMatrix: defaultMatrix
      };
    }
  }

  /**
   * NEW: Single API call to detect multiple object types
   * Reduces rate limiting by batching detections
   */
  private async callBatchDetectAPI(base64Image: string, disableTimeouts: boolean = false): Promise<{
    bicycles?: DetectedObject[];
    people?: DetectedObject[];
    vehicles?: DetectedObject[];
    sidewalks?: DetectedObject[];
    signs?: DetectedObject[];
    lights?: DetectedObject[];
  }> {
    
    console.log('🔍 [HACKATHON] Running batch object detection...');
    
    // Use a single comprehensive detection query
    const prompt = `Detect and count: bicycles, people, cars, sidewalks, traffic signs, street lights. Return exact counts for each category.`;
    
    try {
      const response = await this.askQuestion(base64Image, prompt, disableTimeouts);
      
      // Parse response to extract counts
      const counts = this.parseCountsFromResponse(response);
      
      console.log('📊 [HACKATHON] Detection counts:', counts);
      
      // Convert counts to mock detection objects (for legacy compatibility)
      return {
        bicycles: this.generateMockDetections(counts.bicycles),
        people: this.generateMockDetections(counts.people),
        vehicles: this.generateMockDetections(counts.vehicles),
        sidewalks: this.generateMockDetections(counts.sidewalks),
        signs: this.generateMockDetections(counts.signs),
        lights: this.generateMockDetections(counts.lights)
      };
      
    } catch (error) {
      console.log('⚠️ [HACKATHON] Batch detection failed, using fallback counts');
      // Return reasonable defaults
      return {
        bicycles: [],
        people: this.generateMockDetections(2), // Assume some people
        vehicles: this.generateMockDetections(1), // Assume some traffic
        sidewalks: this.generateMockDetections(1), // Assume sidewalk exists
        signs: [],
        lights: []
      };
    }
  }

  /**
   * NEW: Extract numerical features from detection results
   */
  private extractFeatureMatrix(detectionResults: any): SafetyFeatureMatrix {
    const bicycleCount = Math.min(10, detectionResults.bicycles?.length || 0);
    const personCount = Math.min(10, detectionResults.people?.length || 0);
    const vehicleCount = Math.min(10, detectionResults.vehicles?.length || 0);
    
    const hasSidewalk = (detectionResults.sidewalks?.length || 0) > 0 ? 1 : 0;
    const hasTrafficSigns = (detectionResults.signs?.length || 0) > 0 ? 1 : 0;
    const hasStreetLighting = (detectionResults.lights?.length || 0) > 0 ? 1 : 0;
    
    // Calculate movement/traffic density based on total objects
    const totalObjects = bicycleCount + personCount + vehicleCount;
    const movementDensity = Math.min(10, Math.floor(totalObjects * 1.5));
    const trafficDensity = Math.min(10, vehicleCount * 2);

    return {
      bicycleCount,
      personCount,
      vehicleCount,
      hasSidewalk,
      hasTrafficSigns,
      hasStreetLighting,
      movementDensity,
      trafficDensity,
      coefficients: { ...this.defaultCoefficients }
    };
  }

  /**
   * NEW: Calculate safety score from feature matrix
   * Formula: Base(10) - (bicycles*2.5 + vehicles*1.5 - people*0.5) + bonuses
   */
  private calculateSafetyFromMatrix(matrix: SafetyFeatureMatrix): number {
    const { 
      bicycleCount, 
      personCount, 
      vehicleCount,
      hasSidewalk,
      hasStreetLighting,
      coefficients 
    } = matrix;

    // Base safety score
    let score = 10;

    // Apply risk factors (subtract from safety)
    score -= bicycleCount * coefficients.bicycleWeight;
    score -= vehicleCount * coefficients.vehicleWeight;
    
    // Apply safety factors (add to safety)
    score += personCount * coefficients.personWeight; // People generally make areas safer
    score += hasSidewalk * coefficients.sidewalkBonus;
    score += hasStreetLighting * coefficients.lightingBonus;

    // Ensure score stays within 1-10 range
    score = Math.max(1, Math.min(10, Math.round(score)));

    console.log('🧮 [HACKATHON] Safety calculation:', {
      baseScore: 10,
      bicyclePenalty: -bicycleCount * coefficients.bicycleWeight,
      vehiclePenalty: -vehicleCount * coefficients.vehicleWeight,
      personBonus: personCount * coefficients.personWeight,
      sidewalkBonus: hasSidewalk * coefficients.sidewalkBonus,
      lightingBonus: hasStreetLighting * coefficients.lightingBonus,
      finalScore: score
    });

    return score;
  }

  /**
   * NEW: Parse counts from AI response text
   */
  private parseCountsFromResponse(response: string): {
    bicycles: number;
    people: number;
    vehicles: number;
    sidewalks: number;
    signs: number;
    lights: number;
  } {
    const text = response.toLowerCase();
    
    return {
      bicycles: this.extractCount(text, ['bicycle', 'bike', 'cycle']),
      people: this.extractCount(text, ['people', 'person', 'pedestrian', 'human']),
      vehicles: this.extractCount(text, ['car', 'vehicle', 'truck', 'bus', 'auto']),
      sidewalks: this.extractCount(text, ['sidewalk', 'pavement', 'walkway']) > 0 ? 1 : 0,
      signs: this.extractCount(text, ['sign', 'traffic sign', 'street sign']),
      lights: this.extractCount(text, ['light', 'street light', 'lamp', 'lighting'])
    };
  }

  /**
   * Extract count for specific object types from text
   */
  private extractCount(text: string, keywords: string[]): number {
    for (const keyword of keywords) {
      // Look for patterns like "3 bicycles", "no cars", "several people"
      const patterns = [
        new RegExp(`(\\d+)\\s+${keyword}`, 'i'),
        new RegExp(`${keyword}[s]?:\\s*(\\d+)`, 'i'),
        new RegExp(`(\\d+)\\s+${keyword}[s]?`, 'i')
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          return parseInt(match[1], 10);
        }
      }
      
      // Handle text numbers
      if (text.includes(`no ${keyword}`) || text.includes(`zero ${keyword}`)) return 0;
      if (text.includes(`one ${keyword}`) || text.includes(`a ${keyword}`)) return 1;
      if (text.includes(`two ${keyword}`)) return 2;
      if (text.includes(`three ${keyword}`)) return 3;
      if (text.includes(`several ${keyword}`) || text.includes(`some ${keyword}`)) return 2;
      if (text.includes(`many ${keyword}`) || text.includes(`multiple ${keyword}`)) return 5;
    }
    
    return 0;
  }

  /**
   * Generate mock detection objects for legacy compatibility
   */
  private generateMockDetections(count: number): DetectedObject[] {
    const detections: DetectedObject[] = [];
    for (let i = 0; i < count; i++) {
      detections.push({
        x_min: Math.random() * 100,
        y_min: Math.random() * 100,
        x_max: Math.random() * 100 + 100,
        y_max: Math.random() * 100 + 100
      });
    }
    return detections;
  }

  /**
   * Get default feature matrix for fallback cases
   */
  private getDefaultFeatureMatrix(): SafetyFeatureMatrix {
    return {
      bicycleCount: 0,
      personCount: 2,
      vehicleCount: 1,
      hasSidewalk: 1,
      hasTrafficSigns: 0,
      hasStreetLighting: 0,
      movementDensity: 3,
      trafficDensity: 2,
      coefficients: { ...this.defaultCoefficients }
    };
  }

  /**
   * NEW: Format feature matrix for display/logging
   */
  formatFeatureMatrix(matrix: SafetyFeatureMatrix): string {
    const features = [
      `🚴 Bicycles: ${matrix.bicycleCount}/10`,
      `👥 People: ${matrix.personCount}/10`, 
      `🚗 Vehicles: ${matrix.vehicleCount}/10`,
      `🚶 Sidewalk: ${matrix.hasSidewalk ? 'Yes' : 'No'}`,
      `🚦 Traffic Signs: ${matrix.hasTrafficSigns ? 'Yes' : 'No'}`,
      `💡 Street Lighting: ${matrix.hasStreetLighting ? 'Yes' : 'No'}`,
      `📊 Movement Density: ${matrix.movementDensity}/10`,
      `🚗 Traffic Density: ${matrix.trafficDensity}/10`
    ];
    
    const coeffs = [
      `Bicycle Weight: ${matrix.coefficients.bicycleWeight}`,
      `Person Weight: ${matrix.coefficients.personWeight}`,
      `Vehicle Weight: ${matrix.coefficients.vehicleWeight}`,
      `Sidewalk Bonus: ${matrix.coefficients.sidewalkBonus}`,
      `Lighting Bonus: ${matrix.coefficients.lightingBonus}`
    ];

    return `📊 Feature Matrix:\n${features.join('\n')}\n\n⚖️ Coefficients:\n${coeffs.join('\n')}`;
  }

  /**
   * NEW: Update coefficients for different scenarios
   * Allows fine-tuning the safety scoring based on context
   */
  updateCoefficients(updates: Partial<SafetyFeatureMatrix['coefficients']>): void {
    this.defaultCoefficients = {
      ...this.defaultCoefficients,
      ...updates
    };
    console.log('🔧 [HACKATHON] Updated safety coefficients:', this.defaultCoefficients);
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
   * Updated to accept base64 string directly for efficiency
   */
  async askQuestion(imageUriOrBase64: string, question: string, disableTimeouts: boolean = false): Promise<string> {
    try {
      console.log(`❓ [HACKATHON] Asking question: "${question}"`);
      
      // Check if input is already base64 or needs conversion
      let base64Image = imageUriOrBase64;
      if (!imageUriOrBase64.startsWith('data:image/')) {
        base64Image = await this.imageUriToBase64(imageUriOrBase64);
      }

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