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

class MoondreamService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = MOONDREAM_API_KEY;
    this.baseUrl = MOONDREAM_API_BASE;
  }

  /**
   * Convert image URI to base64 data URI format required by Moondream API
   */
  private async imageUriToBase64(imageUri: string): Promise<string> {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw new Error('Failed to process image');
    }
  }

  /**
   * Detect bicycles and sidewalks in an image using Moondream API
   */
  async detectBicycles(imageUri: string): Promise<BicycleDetectionResult> {
    try {
      // Convert image to base64
      const base64Image = await this.imageUriToBase64(imageUri);

      // Get scene description first
      const sceneDescription = await this.getCaptionForContext(imageUri);

      // Call Moondream API for bicycle detection
      const bicycleResponse = await this.callDetectAPI(base64Image, 'bicycle');
      
      // Also check for 'bike' and 'cyclist' to be thorough
      const bikeResponse = await this.callDetectAPI(base64Image, 'bike');
      const cyclistResponse = await this.callDetectAPI(base64Image, 'cyclist');

      // Detect sidewalks for confirmation
      const sidewalkResponse = await this.callDetectAPI(base64Image, 'sidewalk');
      const pavement = await this.callDetectAPI(base64Image, 'pavement');
      const walkway = await this.callDetectAPI(base64Image, 'walkway');

      // Combine all bicycle detections
      const allBicycles = [
        ...bicycleResponse.objects,
        ...bikeResponse.objects,
        ...cyclistResponse.objects
      ];

      // Combine all sidewalk detections
      const allSidewalks = [
        ...sidewalkResponse.objects,
        ...pavement.objects,
        ...walkway.objects
      ];

      // Remove duplicates (objects that overlap significantly)
      const uniqueBicycles = this.removeDuplicateDetections(allBicycles);
      const uniqueSidewalks = this.removeDuplicateDetections(allSidewalks);

      // Check if scene likely contains a sidewalk using AI
      const hasSidewalk = await this.confirmSidewalkPresence(imageUri, sceneDescription);

      // Calculate safety score based on bicycle count
      const safetyScore = this.calculateSafetyScore(uniqueBicycles.length);
      
      // Determine confidence based on number of detections and scene context
      const confidence = this.determineConfidence(uniqueBicycles.length, hasSidewalk);

      return {
        bicycles: uniqueBicycles,
        sidewalks: uniqueSidewalks,
        totalCount: uniqueBicycles.length,
        confidence,
        safetyScore,
        sceneDescription,
        hasSidewalk
      };

    } catch (error) {
      console.error('Error detecting bicycles:', error);
      throw new Error('Failed to detect bicycles in image');
    }
  }

  /**
   * Use AI to confirm if the image contains a sidewalk/pedestrian area
   */
  private async confirmSidewalkPresence(imageUri: string, sceneDescription: string): Promise<boolean> {
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
      const answer = await this.askQuestion(imageUri, question);
      
      return answer.toLowerCase().includes('yes');
    } catch (error) {
      console.error('Error confirming sidewalk presence:', error);
      // Fallback - assume it's a sidewalk if we got this far
      return true;
    }
  }

  /**
   * Call Moondream detect API for a specific object type
   */
  private async callDetectAPI(base64Image: string, objectType: string): Promise<MoondreamDetectionResult> {
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
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Moondream API error:', errorText);
      throw new Error(`Moondream API error: ${response.status}`);
    }

    return await response.json();
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
  async askQuestion(imageUri: string, question: string): Promise<string> {
    try {
      const base64Image = await this.imageUriToBase64(imageUri);

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
        })
      });

      if (!response.ok) {
        throw new Error(`Moondream API error: ${response.status}`);
      }

      const result = await response.json();
      return result.answer || result.text || 'No answer received';

    } catch (error) {
      console.error('Error asking question:', error);
      throw new Error('Failed to get answer from Moondream');
    }
  }

  /**
   * Get image caption for additional context
   */
  async getCaptionForContext(imageUri: string): Promise<string> {
    try {
      const base64Image = await this.imageUriToBase64(imageUri);

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
        })
      });

      if (!response.ok) {
        throw new Error(`Moondream API error: ${response.status}`);
      }

      const result = await response.json();
      return result.caption || 'No caption available';

    } catch (error) {
      console.error('Error getting caption:', error);
      return 'Caption unavailable';
    }
  }
}

export default new MoondreamService(); 