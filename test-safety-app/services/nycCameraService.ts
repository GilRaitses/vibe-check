// NYC Traffic Camera Service for Risk Assessment
import MoondreamService from './moondreamService';

export interface NYCCamera {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  area: string;
  isOnline: boolean;
}

export interface CameraRiskAnalysis {
  cameraId: string;
  riskScore: number; // 1-10 scale (1 = high risk, 10 = low risk)
  truckCount: number;
  bikeCount: number;
  pedestrianCount: number;
  trafficDensity: 'low' | 'medium' | 'high';
  sidewalkCondition: 'clear' | 'obstructed' | 'unsafe';
  confidence: 'low' | 'medium' | 'high';
  lastAnalyzed: Date;
  sceneDescription: string;
}

export interface HeatMapRegion {
  id: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  averageRiskScore: number;
  cameraCount: number;
  lastUpdated: Date;
}

class NYCCameraService {
  private readonly NYC_TMC_API = 'https://nyctmc.org/api/cameras';
  private cameraCache: Map<string, NYCCamera> = new Map();
  private analysisCache: Map<string, CameraRiskAnalysis> = new Map();
  private lastFetch: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  // Rate limiting for Moondream API
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private readonly REQUEST_DELAY = 2000; // 2 seconds between requests
  private readonly MAX_CONCURRENT = 1; // Only 1 request at a time
  private activeRequests = 0;

  /**
   * Add request to queue with rate limiting
   */
  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          console.log(`⏳ [HACKATHON] Processing queued Moondream request (${this.activeRequests} active, ${this.requestQueue.length} in queue)`);
          const result = await requestFn();
          console.log(`✅ [HACKATHON] Moondream request completed successfully`);
          resolve(result);
        } catch (error) {
          console.error(`❌ [HACKATHON] Moondream request failed:`, error);
          reject(error);
        }
      });
      
      console.log(`📝 [HACKATHON] Added request to queue (queue size: ${this.requestQueue.length})`);
      this.processQueue();
    });
  }

  /**
   * Process the request queue with rate limiting
   */
  private async processQueue() {
    if (this.isProcessingQueue || this.activeRequests >= this.MAX_CONCURRENT) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0 && this.activeRequests < this.MAX_CONCURRENT) {
      const request = this.requestQueue.shift();
      if (request) {
        this.activeRequests++;
        
        try {
          await request();
        } catch (error) {
          console.error('Queued request failed:', error);
        }
        
        this.activeRequests--;
        
        // Wait before processing next request
        if (this.requestQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY));
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Fetch all NYC traffic cameras from the official NYC TMC API
   */
  async fetchCameras(): Promise<NYCCamera[]> {
    try {
      // Check cache first
      if (this.lastFetch && Date.now() - this.lastFetch.getTime() < this.CACHE_DURATION) {
        console.log('📋 Using cached camera data');
        return Array.from(this.cameraCache.values());
      }

      console.log('🔍 Fetching NYC traffic cameras from TMC API...');
      
      const response = await fetch(this.NYC_TMC_API, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'NYC-Safety-App/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rawData = await response.json();
      console.log(`✅ Received ${rawData.length} cameras from NYC TMC API`);

      // Transform the data to our format
      const cameras: NYCCamera[] = rawData.map((item: any) => ({
        id: item.id,
        name: item.name,
        latitude: item.latitude,
        longitude: item.longitude,
        imageUrl: item.imageUrl,
        area: item.area,
        isOnline: item.isOnline === 'true' || item.isOnline === true
      })).filter((camera: NYCCamera) => 
        camera.latitude && 
        camera.longitude && 
        camera.isOnline &&
        camera.imageUrl
      );

      // Cache the cameras
      this.cameraCache.clear();
      cameras.forEach(camera => {
        this.cameraCache.set(camera.id, camera);
      });

      this.lastFetch = new Date();
      console.log(`✅ Successfully loaded ${cameras.length} online NYC traffic cameras`);
      return cameras;

    } catch (error) {
      console.error('❌ Error fetching NYC cameras:', error);
      throw error; // Re-throw the error instead of using fallbacks
    }
  }

  /**
   * Get cameras within a radius of a location
   */
  async getCamerasNearLocation(
    latitude: number, 
    longitude: number, 
    radiusKm: number = 2
  ): Promise<NYCCamera[]> {
    const allCameras = await this.fetchCameras();
    
    return allCameras.filter(camera => {
      const distance = this.calculateDistance(
        latitude, longitude,
        camera.latitude, camera.longitude
      );
      return distance <= radiusKm;
    });
  }

  /**
   * Analyze a camera image for risk factors
   */
  async analyzeCameraRisk(camera: NYCCamera): Promise<CameraRiskAnalysis> {
    try {
      // Check if we have recent analysis
      const cached = this.analysisCache.get(camera.id);
      if (cached && Date.now() - cached.lastAnalyzed.getTime() < this.CACHE_DURATION) {
        return cached;
      }

      console.log(`🔍 [HACKATHON] Starting AI analysis for camera: ${camera.name} (${camera.area})`);
      console.log(`📸 [HACKATHON] Camera image URL: ${camera.imageUrl}`);
      console.log(`📍 [HACKATHON] Camera location: ${camera.latitude}, ${camera.longitude}`);

      // Use rate-limited requests to avoid overwhelming the API
      console.log(`🤖 [HACKATHON] MOONDREAM API CALL #1: Bicycle detection for camera ${camera.id}`);
      const bicycleResult = await this.queueRequest(() => 
        MoondreamService.detectBicycles(camera.imageUrl)
      );
      console.log(`✅ [HACKATHON] Bicycle detection completed:`, bicycleResult);
      
      // Detect trucks and traffic with rate limiting
      const truckQuestion = "How many trucks, delivery vehicles, or large vehicles do you see in this image?";
      console.log(`🤖 [HACKATHON] MOONDREAM API CALL #2: Truck detection for camera ${camera.id}`);
      console.log(`❓ [HACKATHON] Question: "${truckQuestion}"`);
      const truckAnswer = await this.queueRequest(() => 
        MoondreamService.askQuestion(camera.imageUrl, truckQuestion)
      );
      console.log(`✅ [HACKATHON] Truck detection answer: "${truckAnswer}"`);
      
      const pedestrianQuestion = "How many pedestrians or people walking do you see in this image?";
      console.log(`🤖 [HACKATHON] MOONDREAM API CALL #3: Pedestrian detection for camera ${camera.id}`);
      console.log(`❓ [HACKATHON] Question: "${pedestrianQuestion}"`);
      const pedestrianAnswer = await this.queueRequest(() => 
        MoondreamService.askQuestion(camera.imageUrl, pedestrianQuestion)
      );
      console.log(`✅ [HACKATHON] Pedestrian detection answer: "${pedestrianAnswer}"`);
      
      const trafficQuestion = "How would you describe the traffic density: light, moderate, or heavy?";
      console.log(`🤖 [HACKATHON] MOONDREAM API CALL #4: Traffic density analysis for camera ${camera.id}`);
      console.log(`❓ [HACKATHON] Question: "${trafficQuestion}"`);
      const trafficAnswer = await this.queueRequest(() => 
        MoondreamService.askQuestion(camera.imageUrl, trafficQuestion)
      );
      console.log(`✅ [HACKATHON] Traffic density answer: "${trafficAnswer}"`);

      // Extract counts from AI responses
      const truckCount = this.extractNumberFromResponse(truckAnswer);
      const pedestrianCount = this.extractNumberFromResponse(pedestrianAnswer);
      const bikeCount = bicycleResult.totalCount;

      console.log(`🧮 [HACKATHON] Extracted counts from AI responses:`);
      console.log(`  🚛 Trucks: ${truckCount}`);
      console.log(`  🚴 Bicycles: ${bikeCount}`);
      console.log(`  🚶 Pedestrians: ${pedestrianCount}`);

      // Determine traffic density
      const trafficDensity = this.parseTrafficDensity(trafficAnswer);
      console.log(`🚦 [HACKATHON] Parsed traffic density: ${trafficDensity}`);

      // Calculate risk score (1-10, lower = more risky)
      const riskScore = this.calculateRiskScore({
        bikeCount,
        truckCount,
        pedestrianCount,
        trafficDensity,
        hasSidewalk: bicycleResult.hasSidewalk
      });

      console.log(`⚠️ [HACKATHON] Calculated risk score: ${riskScore}/10 (1=high risk, 10=low risk)`);
      console.log(`🛤️ [HACKATHON] Sidewalk condition: ${bicycleResult.hasSidewalk ? 'clear' : 'unsafe'}`);

      const analysis: CameraRiskAnalysis = {
        cameraId: camera.id,
        riskScore,
        truckCount,
        bikeCount,
        pedestrianCount,
        trafficDensity,
        sidewalkCondition: bicycleResult.hasSidewalk ? 'clear' : 'unsafe',
        confidence: bicycleResult.confidence,
        lastAnalyzed: new Date(),
        sceneDescription: bicycleResult.sceneDescription
      };

      console.log(`📊 [HACKATHON] FINAL ANALYSIS RESULT for ${camera.name}:`, analysis);
      console.log(`🎯 [HACKATHON] Analysis completed for camera ${camera.id} - Risk Score: ${riskScore}`);

      // Cache the analysis
      this.analysisCache.set(camera.id, analysis);
      return analysis;

    } catch (error) {
      console.error(`Error analyzing camera ${camera.id}:`, error);
      
      // Return a default low-confidence analysis
      return {
        cameraId: camera.id,
        riskScore: 5, // Neutral
        truckCount: 0,
        bikeCount: 0,
        pedestrianCount: 0,
        trafficDensity: 'medium',
        sidewalkCondition: 'clear',
        confidence: 'low',
        lastAnalyzed: new Date(),
        sceneDescription: 'Analysis failed'
      };
    }
  }

  /**
   * Analyze multiple cameras in parallel for a region
   */
  async analyzeRegionRisk(
    latitude: number,
    longitude: number,
    radiusKm: number = 1
  ): Promise<HeatMapRegion> {
    const cameras = await this.getCamerasNearLocation(latitude, longitude, radiusKm);
    
    // Analyze up to 5 cameras in parallel to avoid overwhelming the API
    const analysisPromises = cameras.slice(0, 5).map(camera => 
      this.analyzeCameraRisk(camera)
    );
    
    const analyses = await Promise.allSettled(analysisPromises);
    const successfulAnalyses = analyses
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<CameraRiskAnalysis>).value);

    // Calculate average risk score
    const averageRiskScore = successfulAnalyses.length > 0
      ? successfulAnalyses.reduce((sum, analysis) => sum + analysis.riskScore, 0) / successfulAnalyses.length
      : 5; // Default neutral score

    return {
      id: `region_${latitude}_${longitude}`,
      bounds: {
        north: latitude + (radiusKm / 111), // Rough conversion km to degrees
        south: latitude - (radiusKm / 111),
        east: longitude + (radiusKm / (111 * Math.cos(latitude * Math.PI / 180))),
        west: longitude - (radiusKm / (111 * Math.cos(latitude * Math.PI / 180)))
      },
      averageRiskScore,
      cameraCount: cameras.length,
      lastUpdated: new Date()
    };
  }

  /**
   * Calculate distance between two points in kilometers
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Extract number from AI response text
   */
  private extractNumberFromResponse(response: string): number {
    const numbers = response.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      return parseInt(numbers[0], 10);
    }
    return 0;
  }

  /**
   * Parse traffic density from AI response
   */
  private parseTrafficDensity(response: string): 'low' | 'medium' | 'high' {
    const lowKeywords = ['light', 'low', 'minimal', 'sparse'];
    const highKeywords = ['heavy', 'dense', 'congested', 'busy'];
    
    const responseLower = response.toLowerCase();
    
    if (lowKeywords.some(keyword => responseLower.includes(keyword))) {
      return 'low';
    }
    if (highKeywords.some(keyword => responseLower.includes(keyword))) {
      return 'high';
    }
    return 'medium';
  }

  /**
   * Calculate risk score based on various factors
   */
  private calculateRiskScore(factors: {
    bikeCount: number;
    truckCount: number;
    pedestrianCount: number;
    trafficDensity: 'low' | 'medium' | 'high';
    hasSidewalk: boolean;
  }): number {
    let score = 10; // Start with maximum safety

    // Bikes on sidewalk reduce safety significantly
    score -= factors.bikeCount * 2;

    // Trucks reduce safety
    score -= factors.truckCount * 1.5;

    // Traffic density affects safety
    if (factors.trafficDensity === 'high') score -= 2;
    else if (factors.trafficDensity === 'medium') score -= 1;

    // No sidewalk is very unsafe
    if (!factors.hasSidewalk) score -= 3;

    // High pedestrian count with other risks is more dangerous
    if (factors.pedestrianCount > 5 && (factors.bikeCount > 0 || factors.truckCount > 0)) {
      score -= 1;
    }

    // Ensure score stays within 1-10 range
    return Math.max(1, Math.min(10, Math.round(score)));
  }

  /**
   * Get cached analysis for quick access
   */
  getCachedAnalysis(cameraId: string): CameraRiskAnalysis | null {
    return this.analysisCache.get(cameraId) || null;
  }

  /**
   * Clear caches to force fresh data
   */
  clearCache(): void {
    this.cameraCache.clear();
    this.analysisCache.clear();
    this.lastFetch = null;
  }
}

export default new NYCCameraService(); 