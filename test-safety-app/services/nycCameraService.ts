// NYC Traffic Camera Service for Risk Assessment
import MoondreamService, { ProgressCallback, AnalysisProgress } from './moondreamService';
import dataSourceService from './dataSourceService';
import asyncStorageService, { CameraMetadata } from './asyncStorageService';

// Manhattan outline coordinates (approximate boundary)
const MANHATTAN_BOUNDARY = [
  { latitude: 40.8776, longitude: -73.9102 }, // North tip (Inwood)
  { latitude: 40.8776, longitude: -73.9442 }, // NW corner
  { latitude: 40.8485, longitude: -73.9442 }, // West side upper
  { latitude: 40.8007, longitude: -73.9735 }, // West side middle
  { latitude: 40.7589, longitude: -73.9896 }, // West side lower
  { latitude: 40.7505, longitude: -74.0134 }, // SW corner (Battery Park)
  { latitude: 40.7047, longitude: -74.0134 }, // South tip
  { latitude: 40.7047, longitude: -73.9734 }, // SE corner
  { latitude: 40.7285, longitude: -73.9734 }, // East side lower
  { latitude: 40.7831, longitude: -73.9441 }, // East side upper
  { latitude: 40.8776, longitude: -73.9102 }, // Back to north tip
];

export interface NYCCamera {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  area: string;
  isOnline: boolean;
}

export interface CameraCluster {
  id: string;
  latitude: number;
  longitude: number;
  cameraCount: number;
  cameras: NYCCamera[];
  region: string;
  zoomLevel: number;
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

export interface BatchAnalysisResult {
  compositeImageUrl: string;
  cameraIds: string[];
  regionName: string;
  totalBicycles: number;
  totalTrucks: number;
  totalPedestrians: number;
  averageRiskScore: number;
  confidence: 'high' | 'medium' | 'low';
  sceneDescription: string;
  analysisTimestamp: Date;
  individualCameras: {
    camera: NYCCamera;
    analysis: CameraRiskAnalysis;
  }[];
}

export interface HeatMapData {
  id: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  riskScore: number;
  cameraCount: number;
  lastAnalyzed: Date;
  analysisType: 'individual' | 'batch' | 'territory';
  color: string; // Heat map color based on risk
  analysisState: 'unanalyzed' | 'queued' | 'analyzing' | 'completed' | 'error';
}

// Camera territory for Manhattan subdivision
export interface CameraTerritory {
  id: string;
  cameraId: string;
  camera: NYCCamera;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  polygon: Array<{latitude: number; longitude: number}>;
  analysisState: 'unanalyzed' | 'queued' | 'analyzing' | 'completed' | 'error';
  riskScore?: number;
  lastAnalyzed?: Date;
}

class NYCCameraService {
  private readonly NYC_TMC_API = 'https://nyctmc.org/api/cameras';
  private cameraCache: Map<string, NYCCamera> = new Map();
  private analysisCache: Map<string, CameraRiskAnalysis> = new Map();
  private clusterCache: Map<string, CameraCluster[]> = new Map();
  private lastFetch: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  // Rate limiting for Moondream API
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private readonly REQUEST_DELAY = 2000; // 2 seconds between requests
  private readonly MAX_CONCURRENT = 1; // Only 1 request at a time
  private activeRequests = 0;

  // Clustering configuration
  private readonly ZOOM_BREAKPOINTS = {
    1: 0.5,   // Very zoomed out - large clusters (0.5 degree grid)
    2: 0.2,   // Zoomed out - medium clusters (0.2 degree grid)
    3: 0.1,   // Medium zoom - smaller clusters (0.1 degree grid)
    4: 0.05,  // Zoomed in - very small clusters (0.05 degree grid)
    5: 0.01   // Very zoomed in - individual cameras (0.01 degree grid)
  };

  private heatMapCache: Map<string, HeatMapData> = new Map();
  
  // Manhattan territory system
  private territoryCache: Map<string, CameraTerritory> = new Map();
  private territoriesGenerated = false;

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
  async analyzeCameraRisk(camera: NYCCamera, progressCallback?: ProgressCallback, disableTimeouts: boolean = false): Promise<CameraRiskAnalysis> {
    try {
      // Check if we have recent analysis
      const cached = this.analysisCache.get(camera.id);
      if (cached && Date.now() - cached.lastAnalyzed.getTime() < this.CACHE_DURATION) {
        return cached;
      }

      console.log(`🔍 [HACKATHON] Starting AI analysis for camera: ${camera.name} (${camera.area})`);
      console.log(`📸 [HACKATHON] Camera image URL: ${camera.imageUrl}`);
      console.log(`📍 [HACKATHON] Camera location: ${camera.latitude}, ${camera.longitude}`);

      // Use NEW optimized config-based vision analysis - single API call
      console.log(`🔥 [HACKATHON] MOONDREAM API CALL: Optimized config-based analysis for camera ${camera.id}`);
      const rawVisionData = await this.queueRequest(() => 
        MoondreamService.analyzeVisionOptimized(camera.imageUrl)
      );
      console.log(`✅ [HACKATHON] Optimized vision analysis completed:`, rawVisionData);
      
      // Extract data from the optimized raw vision response
      const bikeCount = rawVisionData.bikes_street + rawVisionData.bikes_bike_lane + rawVisionData.bikes_crosswalk;
      const truckCount = rawVisionData.vehicles_moving + rawVisionData.vehicles_stopped;
      const pedestrianCount = rawVisionData.people_sidewalk + rawVisionData.people_street + rawVisionData.people_moving;
      
      // Map activity levels to traffic density
      const trafficDensity = this.mapActivityToTrafficDensity(rawVisionData.activity_traffic);

      console.log(`🧮 [HACKATHON] Extracted data from optimized vision analysis:`);
      console.log(`  🚴 Active Cyclists: ${bikeCount}`);
      console.log(`  🚛 Vehicles/Trucks: ${truckCount}`);
      console.log(`  🚶 Pedestrians: ${pedestrianCount}`);
      console.log(`  🚦 Traffic Density: ${trafficDensity}`);
      console.log(`  🛤️ Sidewalk: ${rawVisionData.people_sidewalk > 0 ? 'Present' : 'None'}`);
      console.log(`  💡 Lighting: ${rawVisionData.infrastructure_lighting > 2 ? 'Good' : 'Poor'}`);
      console.log(`  🚥 Traffic Signs: ${rawVisionData.infrastructure_signs} signs detected`);

      // Calculate risk score (1-10, lower = more risky)
      const hasSidewalk = rawVisionData.people_sidewalk > 0;
      const riskScore = this.calculateRiskScore({
        bikeCount,
        truckCount,
        pedestrianCount,
        trafficDensity,
        hasSidewalk
      });

      console.log(`⚠️ [HACKATHON] Calculated risk score: ${riskScore}/10 (1=high risk, 10=low risk)`);
      console.log(`🛤️ [HACKATHON] Sidewalk condition: ${hasSidewalk ? 'clear' : 'unsafe'}`);

      const analysis: CameraRiskAnalysis = {
        cameraId: camera.id,
        riskScore,
        truckCount,
        bikeCount,
        pedestrianCount,
        trafficDensity,
        sidewalkCondition: hasSidewalk ? 'clear' : 'unsafe',
        confidence: 'medium', // Default confidence for optimized analysis
        lastAnalyzed: new Date(),
        sceneDescription: `Optimized analysis: ${bikeCount} bikes, ${truckCount} vehicles, ${pedestrianCount} people`
      };

      console.log(`📊 [HACKATHON] FINAL ANALYSIS RESULT for ${camera.name}:`, analysis);
      console.log(`🎯 [HACKATHON] Analysis completed for camera ${camera.id} - Risk Score: ${riskScore}`);

      // Cache the analysis
      this.analysisCache.set(camera.id, analysis);
      
      // Update heat map with individual analysis
      await this.updateHeatMapWithIndividualAnalysis(camera, analysis);
      
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
   * Map traffic density from new categorical format to old format
   */
  private mapTrafficDensity(density: 'light' | 'moderate' | 'heavy' | 'gridlock'): 'low' | 'medium' | 'high' {
    switch (density) {
      case 'light':
        return 'low';
      case 'moderate':
        return 'medium';
      case 'heavy':
      case 'gridlock':
        return 'high';
      default:
        return 'medium';
    }
  }

  /**
   * Map activity level (0-4) to traffic density
   */
  private mapActivityToTrafficDensity(activityLevel: number): 'low' | 'medium' | 'high' {
    if (activityLevel <= 1) return 'low';
    if (activityLevel >= 3) return 'high';
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
    this.clusterCache.clear();
    this.lastFetch = null;
  }

  /**
   * Get camera clusters for a specific zoom level
   */
  async getCameraClusters(zoomLevel: number, bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  }): Promise<CameraCluster[]> {
    try {
      const cacheKey = `zoom_${zoomLevel}_${bounds ? JSON.stringify(bounds) : 'all'}`;
      
      // Check cache first
      if (this.clusterCache.has(cacheKey)) {
        console.log(`📋 [HACKATHON] Using cached clusters for zoom level ${zoomLevel}`);
        return this.clusterCache.get(cacheKey)!;
      }

      console.log(`🔍 [HACKATHON] Generating camera clusters for zoom level ${zoomLevel}`);
      
      const allCameras = await this.fetchCameras();
      let camerasToCluster = allCameras;

      // Filter by bounds if provided
      if (bounds) {
        camerasToCluster = allCameras.filter(camera => 
          camera.latitude >= bounds.south &&
          camera.latitude <= bounds.north &&
          camera.longitude >= bounds.west &&
          camera.longitude <= bounds.east
        );
      }

      const gridSize = this.ZOOM_BREAKPOINTS[zoomLevel as keyof typeof this.ZOOM_BREAKPOINTS] || 0.1;
      const clusters = this.clusterCameras(camerasToCluster, gridSize, zoomLevel);

      // Cache the result
      this.clusterCache.set(cacheKey, clusters);
      
      console.log(`✅ [HACKATHON] Generated ${clusters.length} clusters for zoom level ${zoomLevel}`);
      return clusters;

    } catch (error) {
      console.error('❌ [HACKATHON] Error generating camera clusters:', error);
      throw error;
    }
  }

  /**
   * Cluster cameras into groups based on grid size
   */
  private clusterCameras(cameras: NYCCamera[], gridSize: number, zoomLevel: number): CameraCluster[] {
    const clusters: Map<string, CameraCluster> = new Map();

    cameras.forEach(camera => {
      // Calculate grid cell
      const gridLat = Math.floor(camera.latitude / gridSize) * gridSize;
      const gridLng = Math.floor(camera.longitude / gridSize) * gridSize;
      const gridKey = `${gridLat}_${gridLng}`;

      if (!clusters.has(gridKey)) {
        clusters.set(gridKey, {
          id: `cluster_${gridKey}_zoom${zoomLevel}`,
          latitude: gridLat + (gridSize / 2), // Center of grid cell
          longitude: gridLng + (gridSize / 2), // Center of grid cell
          cameraCount: 0,
          cameras: [],
          region: this.getRegionName(gridLat + (gridSize / 2), gridLng + (gridSize / 2)),
          zoomLevel
        });
      }

      const cluster = clusters.get(gridKey)!;
      cluster.cameras.push(camera);
      cluster.cameraCount = cluster.cameras.length;

      // Update cluster center to be average of all cameras in cluster
      const avgLat = cluster.cameras.reduce((sum, cam) => sum + cam.latitude, 0) / cluster.cameras.length;
      const avgLng = cluster.cameras.reduce((sum, cam) => sum + cam.longitude, 0) / cluster.cameras.length;
      cluster.latitude = avgLat;
      cluster.longitude = avgLng;
    });

    return Array.from(clusters.values());
  }

  /**
   * Get region name based on coordinates (improved NYC detection)
   */
  private getRegionName(lat: number, lng: number): string {
    // More accurate NYC region detection
    console.log(`🗺️ [HACKATHON] Determining region for coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    
    // Manhattan: Roughly between -74.02 to -73.93 longitude, 40.70 to 40.88 latitude
    if (lat >= 40.70 && lat <= 40.88 && lng >= -74.02 && lng <= -73.93) {
      console.log(`📍 [HACKATHON] Detected region: Manhattan`);
      return 'Manhattan';
    }
    
    // Brooklyn: South of Manhattan, east of -74.02
    if (lat >= 40.57 && lat <= 40.74 && lng >= -74.05 && lng <= -73.83) {
      console.log(`📍 [HACKATHON] Detected region: Brooklyn`);
      return 'Brooklyn';
    }
    
    // Queens: East of Manhattan/Brooklyn
    if (lat >= 40.54 && lat <= 40.80 && lng >= -73.96 && lng <= -73.70) {
      console.log(`📍 [HACKATHON] Detected region: Queens`);
      return 'Queens';
    }
    
    // Bronx: North of Manhattan
    if (lat >= 40.79 && lat <= 40.92 && lng >= -73.93 && lng <= -73.77) {
      console.log(`📍 [HACKATHON] Detected region: Bronx`);
      return 'Bronx';
    }
    
    // Staten Island: Southwest
    if (lat >= 40.50 && lat <= 40.65 && lng >= -74.26 && lng <= -74.05) {
      console.log(`📍 [HACKATHON] Detected region: Staten Island`);
      return 'Staten Island';
    }
    
    // Default fallback with more specific detection
    if (lng < -74.0) {
      console.log(`📍 [HACKATHON] Detected region: Manhattan (fallback - west of -74.0)`);
      return 'Manhattan';
    }
    
    console.log(`📍 [HACKATHON] Detected region: NYC Area (unknown)`);
    return 'NYC Area';
  }

  /**
   * Get individual camera details
   */
  async getCameraById(cameraId: string): Promise<NYCCamera | null> {
    const allCameras = await this.fetchCameras();
    return allCameras.find(camera => camera.id === cameraId) || null;
  }

  /**
   * Create composite image from multiple camera feeds for batch analysis
   */
  async createCompositeImage(cameras: NYCCamera[]): Promise<string> {
    try {
      console.log(`🖼️ [HACKATHON] Creating composite image from ${cameras.length} cameras`);
      
      // For now, we'll create a simple grid layout
      // In a real implementation, you'd use Canvas or Image manipulation library
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate grid size (e.g., 2x2 for 4 cameras, 3x2 for 6 cameras)
      const gridCols = Math.ceil(Math.sqrt(cameras.length));
      const gridRows = Math.ceil(cameras.length / gridCols);
      
      const imageWidth = 320; // Individual image width
      const imageHeight = 240; // Individual image height
      
      canvas.width = gridCols * imageWidth;
      canvas.height = gridRows * imageHeight;
      
      // Load and draw each camera image
      const imagePromises = cameras.map(async (camera, index) => {
        return new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const col = index % gridCols;
            const row = Math.floor(index / gridCols);
            const x = col * imageWidth;
            const y = row * imageHeight;
            
            ctx?.drawImage(img, x, y, imageWidth, imageHeight);
            resolve();
          };
          img.onerror = reject;
          img.src = camera.imageUrl;
        });
      });
      
      await Promise.all(imagePromises);
      
      // Convert canvas to base64
      const compositeDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      console.log(`✅ [HACKATHON] Composite image created (${canvas.width}x${canvas.height})`);
      
      return compositeDataUrl;
      
    } catch (error) {
      console.error('❌ [HACKATHON] Error creating composite image:', error);
      throw new Error('Failed to create composite image');
    }
  }

  /**
   * Analyze multiple cameras as a batch using composite image
   */
  async analyzeCameraBatch(cameras: NYCCamera[]): Promise<BatchAnalysisResult> {
    try {
      console.log(`🎯 [HACKATHON] Starting batch analysis for ${cameras.length} cameras`);
      
      // Create composite image
      const compositeImageUrl = await this.createCompositeImage(cameras);
      
      // Analyze composite image with Moondream
      const batchAnalysis = await MoondreamService.detectBicycles(compositeImageUrl);
      
      // Also analyze individual cameras for detailed breakdown
      const individualAnalyses = await Promise.all(
        cameras.map(async (camera) => {
          try {
            const analysis = await this.analyzeCameraRisk(camera);
            return { camera, analysis };
          } catch (error) {
            console.warn(`⚠️ [HACKATHON] Individual analysis failed for ${camera.name}:`, error);
            // Return default analysis if individual fails
            return {
              camera,
              analysis: {
                cameraId: camera.id,
                riskScore: 5,
                truckCount: 0,
                bikeCount: 0,
                pedestrianCount: 0,
                trafficDensity: 'medium' as const,
                sidewalkCondition: 'clear' as const,
                confidence: 'low' as const,
                lastAnalyzed: new Date(),
                sceneDescription: 'Individual analysis unavailable'
              }
            };
          }
        })
      );
      
      // Calculate aggregate metrics
      const totalBicycles = individualAnalyses.reduce((sum, item) => sum + item.analysis.bikeCount, 0);
      const totalTrucks = individualAnalyses.reduce((sum, item) => sum + item.analysis.truckCount, 0);
      const totalPedestrians = individualAnalyses.reduce((sum, item) => sum + item.analysis.pedestrianCount, 0);
      const averageRiskScore = individualAnalyses.reduce((sum, item) => sum + item.analysis.riskScore, 0) / individualAnalyses.length;
      
      // Determine region name from camera locations
      const regionName = this.getRegionName(
        cameras.reduce((sum, cam) => sum + cam.latitude, 0) / cameras.length,
        cameras.reduce((sum, cam) => sum + cam.longitude, 0) / cameras.length
      );
      
      const result: BatchAnalysisResult = {
        compositeImageUrl,
        cameraIds: cameras.map(c => c.id),
        regionName,
        totalBicycles,
        totalTrucks,
        totalPedestrians,
        averageRiskScore,
        confidence: batchAnalysis.confidence,
        sceneDescription: `Batch analysis of ${cameras.length} cameras in ${regionName}: ${batchAnalysis.sceneDescription}`,
        analysisTimestamp: new Date(),
        individualCameras: individualAnalyses
      };
      
      // Update heat map with batch analysis
      await this.updateHeatMapWithBatchAnalysis(cameras, result);
      
      console.log(`✅ [HACKATHON] Batch analysis completed for ${regionName}`);
      return result;
      
    } catch (error) {
      console.error('❌ [HACKATHON] Batch analysis failed:', error);
      throw error;
    }
  }

  /**
   * Update heat map data with batch analysis results
   */
  private async updateHeatMapWithBatchAnalysis(cameras: NYCCamera[], batchResult: BatchAnalysisResult): Promise<void> {
    try {
      // Calculate bounds for the camera group
      const latitudes = cameras.map(c => c.latitude);
      const longitudes = cameras.map(c => c.longitude);
      
      const bounds = {
        north: Math.max(...latitudes) + 0.001, // Add small padding
        south: Math.min(...latitudes) - 0.001,
        east: Math.max(...longitudes) + 0.001,
        west: Math.min(...longitudes) - 0.001
      };
      
      // Generate heat map color based on risk score
      const color = this.getRiskColor(batchResult.averageRiskScore);
      
      const heatMapData: HeatMapData = {
        id: `batch_${batchResult.cameraIds.join('_')}`,
        bounds,
        riskScore: batchResult.averageRiskScore,
        cameraCount: cameras.length,
        lastAnalyzed: batchResult.analysisTimestamp,
        analysisType: 'batch',
        color,
        analysisState: 'completed'
      };
      
      this.heatMapCache.set(heatMapData.id, heatMapData);
      console.log(`🗺️ [HACKATHON] Heat map updated for ${batchResult.regionName} (Risk: ${batchResult.averageRiskScore.toFixed(1)})`);
      
    } catch (error) {
      console.error('❌ [HACKATHON] Error updating heat map:', error);
    }
  }

  /**
   * Update heat map with individual camera analysis using Voronoi boundaries
   */
  async updateHeatMapWithIndividualAnalysis(camera: NYCCamera, analysis: CameraRiskAnalysis): Promise<void> {
    try {
      console.log(`🔥 [HACKATHON] HEAT MAP UPDATE: Starting for camera ${camera.name} (${camera.id})`);
      console.log(`🔥 [HACKATHON] Camera location: ${camera.latitude}, ${camera.longitude}`);
      console.log(`🔥 [HACKATHON] Risk score: ${analysis.riskScore}/10`);
      
      // Get nearby cameras to calculate proper boundaries
      console.log(`🔍 [HACKATHON] Finding nearby cameras within 500m...`);
      const nearbyCameras = await this.getCamerasNearLocation(camera.latitude, camera.longitude, 0.5); // 500m radius
      console.log(`🔍 [HACKATHON] Found ${nearbyCameras.length} nearby cameras (including self)`);
      
      const bounds = this.calculateVoronoiBounds(camera, nearbyCameras);
      console.log(`📐 [HACKATHON] Calculated Voronoi bounds:`, bounds);
      
      const color = this.getRiskColor(analysis.riskScore);
      console.log(`🎨 [HACKATHON] Risk color: ${color} for score ${analysis.riskScore}`);
      
      const heatMapData: HeatMapData = {
        id: `individual_${camera.id}`,
        bounds,
        riskScore: analysis.riskScore,
        cameraCount: 1,
        lastAnalyzed: analysis.lastAnalyzed,
        analysisType: 'individual',
        color,
        analysisState: 'completed'
      };
      
      this.heatMapCache.set(heatMapData.id, heatMapData);
      console.log(`✅ [HACKATHON] Heat map data stored in cache with ID: ${heatMapData.id}`);
      console.log(`📊 [HACKATHON] Heat map cache now has ${this.heatMapCache.size} entries`);
      console.log(`🗺️ [HACKATHON] Heat map updated for ${camera.name} (Risk: ${analysis.riskScore}) with Voronoi bounds`);
      
      // Log all current heat map entries for debugging
      console.log(`🔥 [HACKATHON] Current heat map cache contents:`);
      Array.from(this.heatMapCache.entries()).forEach(([id, data]) => {
        console.log(`  - ${id}: Risk ${data.riskScore}, Color ${data.color}, Bounds ${JSON.stringify(data.bounds)}`);
      });
      
    } catch (error) {
      console.error('❌ [HACKATHON] Error updating individual heat map:', error);
      console.error('❌ [HACKATHON] Error details:', error);
    }
  }

  /**
   * Calculate Voronoi cell boundaries for a camera based on nearby cameras
   * Each camera gets the area that's closer to it than to any other camera
   */
  private calculateVoronoiBounds(targetCamera: NYCCamera, allCameras: NYCCamera[]): {
    north: number;
    south: number;
    east: number;
    west: number;
  } {
    // Filter out the target camera and get only nearby ones
    const otherCameras = allCameras.filter(cam => cam.id !== targetCamera.id);
    
    if (otherCameras.length === 0) {
      // No nearby cameras, use default boundary
      return {
        north: targetCamera.latitude + 0.002,
        south: targetCamera.latitude - 0.002,
        east: targetCamera.longitude + 0.002,
        west: targetCamera.longitude - 0.002
      };
    }

    // Find the closest camera in each direction to determine boundaries
    const maxDistance = 0.003; // Maximum boundary distance (~300m)
    const minDistance = 0.0005; // Minimum boundary distance (~50m)
    
    // Calculate distances to all other cameras
    const distances = otherCameras.map(cam => ({
      camera: cam,
      distance: this.calculateDistance(
        targetCamera.latitude, targetCamera.longitude,
        cam.latitude, cam.longitude
      ),
      direction: this.getDirection(targetCamera, cam)
    }));

    // Find closest camera in each cardinal direction
    const north = distances.filter(d => d.direction === 'north').sort((a, b) => a.distance - b.distance)[0];
    const south = distances.filter(d => d.direction === 'south').sort((a, b) => a.distance - b.distance)[0];
    const east = distances.filter(d => d.direction === 'east').sort((a, b) => a.distance - b.distance)[0];
    const west = distances.filter(d => d.direction === 'west').sort((a, b) => a.distance - b.distance)[0];

    // Calculate boundary as halfway point to nearest camera, with min/max limits
    const bounds = {
      north: targetCamera.latitude + Math.min(maxDistance, Math.max(minDistance, 
        north ? (north.camera.latitude - targetCamera.latitude) / 2 : maxDistance)),
      south: targetCamera.latitude - Math.min(maxDistance, Math.max(minDistance,
        south ? (targetCamera.latitude - south.camera.latitude) / 2 : maxDistance)),
      east: targetCamera.longitude + Math.min(maxDistance, Math.max(minDistance,
        east ? (east.camera.longitude - targetCamera.longitude) / 2 : maxDistance)),
      west: targetCamera.longitude - Math.min(maxDistance, Math.max(minDistance,
        west ? (targetCamera.longitude - west.camera.longitude) / 2 : maxDistance))
    };

    console.log(`📐 [HACKATHON] Voronoi bounds for ${targetCamera.name}:`, {
      size: `${((bounds.north - bounds.south) * 111000).toFixed(0)}m x ${((bounds.east - bounds.west) * 111000).toFixed(0)}m`,
      nearestCameras: distances.slice(0, 3).map(d => `${d.camera.name}: ${d.distance.toFixed(0)}m ${d.direction}`)
    });

    return bounds;
  }

  /**
   * Get the general direction from camera A to camera B
   */
  private getDirection(from: NYCCamera, to: NYCCamera): 'north' | 'south' | 'east' | 'west' {
    const latDiff = to.latitude - from.latitude;
    const lngDiff = to.longitude - from.longitude;

    if (Math.abs(latDiff) > Math.abs(lngDiff)) {
      return latDiff > 0 ? 'north' : 'south';
    } else {
      return lngDiff > 0 ? 'east' : 'west';
    }
  }

  /**
   * Get heat map color based on risk score
   */
  private getRiskColor(riskScore: number): string {
    // Risk score is 1-10 (1 = high risk, 10 = low risk)
    if (riskScore <= 3) return '#FF4444'; // High risk - Red
    if (riskScore <= 5) return '#FF8800'; // Medium-high risk - Orange
    if (riskScore <= 7) return '#FFDD00'; // Medium risk - Yellow
    return '#44FF44'; // Low risk - Green
  }

  /**
   * Get all heat map data for visualization
   */
  getHeatMapData(): HeatMapData[] {
    const data = Array.from(this.heatMapCache.values());
    console.log(`🔥 [HACKATHON] getHeatMapData() called - returning ${data.length} heat map regions`);
    
    if (data.length > 0) {
      console.log(`🔥 [HACKATHON] Heat map data being returned:`, data.map(d => ({
        id: d.id,
        riskScore: d.riskScore,
        color: d.color,
        bounds: d.bounds,
        analysisType: d.analysisType
      })));
    } else {
      console.log(`⚠️ [HACKATHON] Heat map cache is empty - no analysis data available`);
    }
    
    return data;
  }

  /**
   * Clear heat map data older than specified time
   */
  clearOldHeatMapData(maxAgeHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    for (const [id, data] of this.heatMapCache.entries()) {
      if (data.lastAnalyzed < cutoffTime) {
        this.heatMapCache.delete(id);
      }
    }
    
    console.log(`🧹 [HACKATHON] Cleaned old heat map data (${this.heatMapCache.size} entries remaining)`);
  }

  /**
   * Generate Manhattan camera territories using Voronoi-style subdivision
   * Each camera gets a polygon territory within Manhattan boundaries
   */
  async generateManhattanTerritories(): Promise<CameraTerritory[]> {
    if (this.territoriesGenerated && this.territoryCache.size > 0) {
      console.log(`🗺️ [HACKATHON] Using cached Manhattan territories (${this.territoryCache.size} territories)`);
      return Array.from(this.territoryCache.values());
    }

    try {
      console.log(`🗺️ [HACKATHON] Generating Manhattan camera territories...`);
      
      // Get all cameras
      const allCameras = await this.fetchCameras();
      
      // Filter cameras within Manhattan bounds
      const manhattanCameras = allCameras.filter(camera => 
        this.isPointInManhattan(camera.latitude, camera.longitude)
      );
      
      console.log(`📍 [HACKATHON] Found ${manhattanCameras.length} cameras within Manhattan boundaries`);
      
      // Generate territories for each camera
      const territories: CameraTerritory[] = [];
      
      for (const camera of manhattanCameras) {
        const territory = this.generateCameraTerritory(camera, manhattanCameras);
        territories.push(territory);
        this.territoryCache.set(territory.id, territory);
      }
      
      this.territoriesGenerated = true;
      console.log(`✅ [HACKATHON] Generated ${territories.length} Manhattan camera territories`);
      
      return territories;
      
    } catch (error) {
      console.error('❌ [HACKATHON] Error generating Manhattan territories:', error);
      throw error;
    }
  }

  /**
   * Check if a point is within Manhattan boundaries
   */
  private isPointInManhattan(lat: number, lng: number): boolean {
    // Use ray casting algorithm to check if point is inside Manhattan polygon
    let inside = false;
    const boundary = MANHATTAN_BOUNDARY;
    
    for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
      const xi = boundary[i].longitude, yi = boundary[i].latitude;
      const xj = boundary[j].longitude, yj = boundary[j].latitude;
      
      if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  /**
   * Generate a Voronoi territory for a specific camera
   */
  private generateCameraTerritory(camera: NYCCamera, allCameras: NYCCamera[]): CameraTerritory {
    // Get nearby cameras for Voronoi calculation
    const otherCameras = allCameras.filter(cam => cam.id !== camera.id);
    
    // Calculate Voronoi cell within Manhattan
    const voronoiPolygon = this.calculateVoronoiPolygonInManhattan(camera, otherCameras);
    
    // Calculate bounds from polygon
    const lats = voronoiPolygon.map(p => p.latitude);
    const lngs = voronoiPolygon.map(p => p.longitude);
    
    const bounds = {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };

    return {
      id: `territory_${camera.id}`,
      cameraId: camera.id,
      camera,
      bounds,
      polygon: voronoiPolygon,
      analysisState: 'unanalyzed'
    };
  }

  /**
   * Calculate Voronoi polygon for camera within Manhattan boundaries
   */
  private calculateVoronoiPolygonInManhattan(
    camera: NYCCamera, 
    otherCameras: NYCCamera[]
  ): Array<{latitude: number; longitude: number}> {
    // Simplified Voronoi: create a polygon where each point is closer to this camera than any other
    const gridResolution = 0.001; // ~100m resolution
    const polygonPoints: Array<{latitude: number; longitude: number}> = [];
    
    // Get bounding box around camera (limited by Manhattan)
    const searchRadius = 0.01; // ~1km search radius
    const minLat = Math.max(40.7047, camera.latitude - searchRadius);
    const maxLat = Math.min(40.8776, camera.latitude + searchRadius);
    const minLng = Math.max(-74.0134, camera.longitude - searchRadius);
    const maxLng = Math.min(-73.9102, camera.longitude + searchRadius);
    
    // Sample points on the boundary of the Voronoi cell
    const boundaryPoints: Array<{latitude: number; longitude: number}> = [];
    
    // Sample along edges of search area
    for (let lat = minLat; lat <= maxLat; lat += gridResolution) {
      for (let lng = minLng; lng <= maxLng; lng += gridResolution) {
        if (!this.isPointInManhattan(lat, lng)) continue;
        
        // Check if this point is closer to our camera than any other
        const distToCamera = this.calculateDistance(camera.latitude, camera.longitude, lat, lng);
        
        let isClosest = true;
        for (const otherCamera of otherCameras) {
          const distToOther = this.calculateDistance(otherCamera.latitude, otherCamera.longitude, lat, lng);
          if (distToOther < distToCamera) {
            isClosest = false;
            break;
          }
        }
        
        if (isClosest) {
          boundaryPoints.push({ latitude: lat, longitude: lng });
        }
      }
    }
    
    // If we found boundary points, create a convex hull
    if (boundaryPoints.length > 0) {
      return this.convexHull(boundaryPoints);
    }
    
    // Fallback: create a small square around the camera
    const fallbackSize = 0.002; // ~200m
    return [
      { latitude: camera.latitude - fallbackSize, longitude: camera.longitude - fallbackSize },
      { latitude: camera.latitude - fallbackSize, longitude: camera.longitude + fallbackSize },
      { latitude: camera.latitude + fallbackSize, longitude: camera.longitude + fallbackSize },
      { latitude: camera.latitude + fallbackSize, longitude: camera.longitude - fallbackSize },
    ];
  }

  /**
   * Calculate convex hull of points (simplified Graham scan)
   */
  private convexHull(points: Array<{latitude: number; longitude: number}>): Array<{latitude: number; longitude: number}> {
    if (points.length <= 3) return points;
    
    // Sort points by longitude, then latitude
    points.sort((a, b) => a.longitude - b.longitude || a.latitude - b.latitude);
    
    // Build lower hull
    const lower = [];
    for (const point of points) {
      while (lower.length >= 2 && this.cross(lower[lower.length-2], lower[lower.length-1], point) <= 0) {
        lower.pop();
      }
      lower.push(point);
    }
    
    // Build upper hull
    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
      const point = points[i];
      while (upper.length >= 2 && this.cross(upper[upper.length-2], upper[upper.length-1], point) <= 0) {
        upper.pop();
      }
      upper.push(point);
    }
    
    // Remove last point of each half because it's repeated
    upper.pop();
    lower.pop();
    
    return lower.concat(upper);
  }

  /**
   * Cross product for convex hull calculation
   */
  private cross(
    o: {latitude: number; longitude: number}, 
    a: {latitude: number; longitude: number}, 
    b: {latitude: number; longitude: number}
  ): number {
    return (a.longitude - o.longitude) * (b.latitude - o.latitude) - (a.latitude - o.latitude) * (b.longitude - o.longitude);
  }

  /**
   * Update territory analysis state
   */
  updateTerritoryState(cameraId: string, state: 'unanalyzed' | 'queued' | 'analyzing' | 'completed' | 'error', riskScore?: number): void {
    const territoryId = `territory_${cameraId}`;
    const territory = this.territoryCache.get(territoryId);
    
    if (territory) {
      territory.analysisState = state;
      if (riskScore !== undefined) {
        territory.riskScore = riskScore;
        territory.lastAnalyzed = new Date();
      }
      
      console.log(`🏢 [HACKATHON] Updated territory ${territory.camera.name} state: ${state}${riskScore ? ` (risk: ${riskScore})` : ''}`);
    }
  }

  /**
   * Get all Manhattan territories with their current states
   */
  async getManhattanTerritories(): Promise<CameraTerritory[]> {
    if (!this.territoriesGenerated) {
      return await this.generateManhattanTerritories();
    }
    return Array.from(this.territoryCache.values());
  }

  /**
   * Get territory heat map data for visualization
   */
  getTerritoryHeatMapData(): HeatMapData[] {
    return Array.from(this.territoryCache.values()).map(territory => ({
      id: `territory_${territory.id}`,
      bounds: territory.bounds,
      riskScore: territory.riskScore || 5,
      cameraCount: 1,
      lastAnalyzed: territory.lastAnalyzed || new Date(),
      analysisType: 'territory' as const,
      color: this.getRiskColor(territory.riskScore || 5),
      analysisState: territory.analysisState
    }));
  }

  /**
   * COMPREHENSIVE DEBUG ANALYSIS: Combines CV + External Data
   */
  async debugAnalyzeCameraRisk(
    camera: NYCCamera, 
    progressCallback?: ProgressCallback, 
    disableTimeouts: boolean = false
  ): Promise<{
    computerVisionAnalysis: CameraRiskAnalysis;
    externalDataAnalysis: any;
    hybridAnalysis: {
      finalRiskScore: number;
      confidenceLevel: number;
      analysisMethod: 'cv_only' | 'external_only' | 'hybrid';
      reasoning: string;
    };
    performanceMetrics: {
      cvTime: number;
      externalDataTime: number;
      totalTime: number;
    };
  }> {
    console.log('🐛 [DEBUG] Starting comprehensive camera analysis...');
    console.log(`📸 [DEBUG] Camera: ${camera.name} (${camera.area})`);
    console.log(`📍 [DEBUG] Location: ${camera.latitude}, ${camera.longitude}`);
    
    const startTime = Date.now();
    
    // 1. Run Computer Vision Analysis (our existing method)
    console.log('🤖 [DEBUG] Step 1/2: Computer Vision Analysis...');
    const cvStartTime = Date.now();
    const cvAnalysis = await this.analyzeCameraRisk(camera, progressCallback, disableTimeouts);
    const cvTime = Date.now() - cvStartTime;
    console.log(`✅ [DEBUG] CV Analysis completed in ${cvTime}ms`);
    console.log(`🎯 [DEBUG] CV Risk Score: ${cvAnalysis.riskScore}/10`);
    
    // 2. Run External Data Analysis
    console.log('🌐 [DEBUG] Step 2/2: External Data Analysis...');
    const externalStartTime = Date.now();
    const externalAnalysis = await dataSourceService.debugAnalysis(
      camera.latitude, 
      camera.longitude, 
      cvAnalysis.bikeCount
    );
    const externalTime = Date.now() - externalStartTime;
    console.log(`✅ [DEBUG] External Analysis completed in ${externalTime}ms`);
    console.log(`🎯 [DEBUG] External Risk Score: ${externalAnalysis.safetyScore}/10`);
    
    // 3. Create Hybrid Analysis
    const hybridAnalysis = this.createHybridAnalysis(cvAnalysis, externalAnalysis);
    
    const totalTime = Date.now() - startTime;
    
    const result = {
      computerVisionAnalysis: cvAnalysis,
      externalDataAnalysis: externalAnalysis,
      hybridAnalysis,
      performanceMetrics: {
        cvTime,
        externalDataTime: externalTime,
        totalTime
      }
    };
    
    // Log comprehensive results
    console.log('🐛 [DEBUG] === COMPREHENSIVE ANALYSIS RESULTS ===');
    console.log('📊 [DEBUG] Computer Vision Analysis:', JSON.stringify(cvAnalysis, null, 2));
    console.log('🌐 [DEBUG] External Data Analysis:', JSON.stringify(externalAnalysis, null, 2));
    console.log('🔄 [DEBUG] Hybrid Analysis:', JSON.stringify(hybridAnalysis, null, 2));
    console.log('⚡ [DEBUG] Performance Metrics:', JSON.stringify(result.performanceMetrics, null, 2));
    
    // Format for display
    const formatted = this.formatComprehensiveResults(result);
    console.log(formatted);
    
    return result;
  }

  /**
   * Create hybrid analysis combining CV and external data
   */
  private createHybridAnalysis(
    cvAnalysis: CameraRiskAnalysis, 
    externalAnalysis: any
  ): {
    finalRiskScore: number;
    confidenceLevel: number;
    analysisMethod: 'cv_only' | 'external_only' | 'hybrid';
    reasoning: string;
  } {
    const cvScore = cvAnalysis.riskScore;
    const externalScore = externalAnalysis.safetyScore;
    const cvConfidence = this.mapConfidenceToNumber(cvAnalysis.confidence);
    
    // Determine analysis method based on data quality
    let analysisMethod: 'cv_only' | 'external_only' | 'hybrid';
    let finalRiskScore: number;
    let confidenceLevel: number;
    let reasoning: string;
    
    // If CV confidence is low, rely more on external data
    if (cvConfidence < 0.6) {
      analysisMethod = 'external_only';
      finalRiskScore = externalScore;
      confidenceLevel = 0.8; // External data is generally more reliable
      reasoning = `Using external data only due to low CV confidence (${cvAnalysis.confidence})`;
    }
    // If external data seems unreliable, use CV only
    else if (externalAnalysis.performanceMetrics.totalTime > 10000) {
      analysisMethod = 'cv_only';
      finalRiskScore = cvScore;
      confidenceLevel = cvConfidence;
      reasoning = `Using CV only due to slow external data (${externalAnalysis.performanceMetrics.totalTime}ms)`;
    }
    // Best case: combine both sources
    else {
      analysisMethod = 'hybrid';
      // Weighted average: 40% CV, 60% external data (external is more comprehensive)
      finalRiskScore = Math.round((cvScore * 0.4 + externalScore * 0.6) * 10) / 10;
      confidenceLevel = Math.min(cvConfidence + 0.2, 1.0); // Hybrid increases confidence
      reasoning = `Hybrid analysis: ${Math.round(0.4*100)}% CV (${cvScore}) + ${Math.round(0.6*100)}% external (${externalScore})`;
    }
    
    return {
      finalRiskScore,
      confidenceLevel,
      analysisMethod,
      reasoning
    };
  }

  /**
   * Map confidence strings to numbers
   */
  private mapConfidenceToNumber(confidence: string): number {
    switch (confidence) {
      case 'high': return 0.9;
      case 'medium': return 0.7;
      case 'low': return 0.4;
      default: return 0.5;
    }
  }

  /**
   * Format comprehensive results for display
   */
  private formatComprehensiveResults(results: any): string {
    const { computerVisionAnalysis, externalDataAnalysis, hybridAnalysis, performanceMetrics } = results;
    const cv = computerVisionAnalysis;
    const ext = externalDataAnalysis;
    const hybrid = hybridAnalysis;
    
    return `
🐛 COMPREHENSIVE CAMERA ANALYSIS RESULTS
=======================================

📸 CAMERA INFORMATION:
Camera ID: ${cv.cameraId}
Analysis Time: ${new Date().toLocaleString()}

🤖 COMPUTER VISION ANALYSIS:
Risk Score: ${cv.riskScore}/10
Confidence: ${cv.confidence}
Bicycles Detected: ${cv.bikeCount}
Trucks Detected: ${cv.truckCount}
Pedestrians: ${cv.pedestrianCount}
Traffic Density: ${cv.trafficDensity}
Sidewalk: ${cv.sidewalkCondition}
Scene: ${cv.sceneDescription}

🌐 EXTERNAL DATA ANALYSIS:
Safety Score: ${ext.safetyScore}/10
Time Category: ${ext.externalData.timeData.timeCategory}
Weather: ${ext.externalData.weatherData.weatherCategory} (${ext.externalData.weatherData.temperature}°F)
Protected Bike Lane: ${ext.externalData.infrastructureData.hasProtectedBikeLane ? 'YES' : 'NO'}
Traffic Light: ${ext.externalData.infrastructureData.hasTrafficLight ? 'YES' : 'NO'}
Historical Accidents: ${ext.externalData.historicalData.accidentCount_lastYear}
Current Traffic Density: ${ext.externalData.trafficData.currentTrafficDensity}/10

🔄 HYBRID ANALYSIS:
Final Risk Score: ${hybrid.finalRiskScore}/10
Analysis Method: ${hybrid.analysisMethod.toUpperCase().replace('_', ' ')}
Confidence Level: ${Math.round(hybrid.confidenceLevel * 100)}%
Reasoning: ${hybrid.reasoning}

⚡ PERFORMANCE COMPARISON:
Computer Vision: ${performanceMetrics.cvTime}ms
External Data: ${performanceMetrics.externalDataTime}ms
Total Time: ${performanceMetrics.totalTime}ms
Speed Improvement: ${performanceMetrics.cvTime > performanceMetrics.externalDataTime ? 
  `External data ${Math.round((performanceMetrics.cvTime / performanceMetrics.externalDataTime - 1) * 100)}% faster` :
  `CV ${Math.round((performanceMetrics.externalDataTime / performanceMetrics.cvTime - 1) * 100)}% faster`}

🎯 FINAL RECOMMENDATION:
${hybrid.finalRiskScore >= 8 ? '✅ SAFE - Low risk for cycling' : 
  hybrid.finalRiskScore >= 6 ? '⚠️ MODERATE - Proceed with caution' : 
  hybrid.finalRiskScore >= 4 ? '🟡 CAUTION - High attention required' : 
  '🔴 HIGH RISK - Avoid if possible'}
`;
  }

  /**
   * QUICK DEBUG TEST: Test a specific camera
   */
  async quickDebugTest(cameraId?: string): Promise<void> {
    console.log('🧪 [TEST] Starting quick camera debug test...');
    
    try {
      // Get cameras
      const cameras = await this.fetchCameras();
      const targetCamera = cameraId 
        ? cameras.find(c => c.id === cameraId) 
        : cameras.find(c => c.area.toLowerCase().includes('manhattan')) || cameras[0];
      
      if (!targetCamera) {
        console.error('❌ [TEST] No suitable camera found');
        return;
      }
      
      console.log(`📸 [TEST] Testing camera: ${targetCamera.name} (${targetCamera.area})`);
      
      const results = await this.debugAnalyzeCameraRisk(targetCamera, undefined, true);
      
      console.log('✅ [TEST] Debug test completed successfully!');
      
    } catch (error) {
      console.error('❌ [TEST] Debug test failed:', error);
    }
  }
}

export default new NYCCameraService(); 