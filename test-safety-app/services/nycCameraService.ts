// NYC Traffic Camera Service for Risk Assessment
import MoondreamService from './moondreamService';

export interface NYCCamera {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  borough: string;
  roadway: string;
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
  private readonly API_BASE = 'https://nyctmc.org/api';
  private cameraCache: Map<string, NYCCamera> = new Map();
  private analysisCache: Map<string, CameraRiskAnalysis> = new Map();
  private lastFetch: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch all NYC traffic cameras
   */
  async fetchCameras(): Promise<NYCCamera[]> {
    try {
      // Check cache first
      if (this.lastFetch && Date.now() - this.lastFetch.getTime() < this.CACHE_DURATION) {
        return Array.from(this.cameraCache.values());
      }

      const response = await fetch(`${this.API_BASE}/camera`);
      if (!response.ok) {
        throw new Error(`NYC API error: ${response.status}`);
      }

      const data = await response.json();
      const cameras: NYCCamera[] = [];

      // Parse the camera data
      for (const camera of data.cameras || []) {
        if (camera.latitude && camera.longitude && camera.url) {
          const nycCamera: NYCCamera = {
            id: camera.id || camera.name,
            name: camera.name || `Camera ${camera.id}`,
            latitude: parseFloat(camera.latitude),
            longitude: parseFloat(camera.longitude),
            imageUrl: camera.url,
            borough: camera.borough || 'Unknown',
            roadway: camera.roadway || 'Unknown'
          };
          cameras.push(nycCamera);
          this.cameraCache.set(nycCamera.id, nycCamera);
        }
      }

      this.lastFetch = new Date();
      console.log(`Fetched ${cameras.length} NYC traffic cameras`);
      return cameras;

    } catch (error) {
      console.error('Error fetching NYC cameras:', error);
      // Return cached data if available
      return Array.from(this.cameraCache.values());
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

      // Use Moondream to analyze the camera image
      const bicycleResult = await MoondreamService.detectBicycles(camera.imageUrl);
      
      // Detect trucks and traffic
      const truckQuestion = "How many trucks, delivery vehicles, or large vehicles do you see in this image?";
      const truckAnswer = await MoondreamService.askQuestion(camera.imageUrl, truckQuestion);
      
      const pedestrianQuestion = "How many pedestrians or people walking do you see in this image?";
      const pedestrianAnswer = await MoondreamService.askQuestion(camera.imageUrl, pedestrianQuestion);
      
      const trafficQuestion = "How would you describe the traffic density: light, moderate, or heavy?";
      const trafficAnswer = await MoondreamService.askQuestion(camera.imageUrl, trafficQuestion);

      // Extract counts from AI responses
      const truckCount = this.extractNumberFromResponse(truckAnswer);
      const pedestrianCount = this.extractNumberFromResponse(pedestrianAnswer);
      const bikeCount = bicycleResult.totalCount;

      // Determine traffic density
      const trafficDensity = this.parseTrafficDensity(trafficAnswer);

      // Calculate risk score (1-10, lower = more risky)
      const riskScore = this.calculateRiskScore({
        bikeCount,
        truckCount,
        pedestrianCount,
        trafficDensity,
        hasSidewalk: bicycleResult.hasSidewalk
      });

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