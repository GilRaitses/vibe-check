import nycCameraService, { NYCCamera, CameraTerritory, HeatMapData } from './nycCameraService';
import dataSourceService from './dataSourceService';

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
}

export interface SafetyZone {
  id: string;
  camera: NYCCamera;
  territory: CameraTerritory;
  distanceFromUser: number;
  processingState: 'queued' | 'processing' | 'completed' | 'error';
  safetyScore?: number;
  lastUpdated?: Date;
  visualState: 'sakura_pink' | 'blinking' | 'heat_color' | 'error_red';
}

export interface SafetyBubble {
  id: string;
  centerLocation: UserLocation;
  radius: number;
  zones: SafetyZone[];
  overallSafetyScore: number;
  completionPercentage: number;
  isComplete: boolean;
  processingStartTime: Date;
  estimatedCompletionTime?: Date;
}

export interface WalkingRoute {
  id: string;
  startLocation: UserLocation;
  endLocation: { latitude: number; longitude: number };
  waypoints: Array<{ latitude: number; longitude: number }>;
  totalDistance: number;
  estimatedWalkTime: number;
  safetyScore: number;
  camerasOnRoute: NYCCamera[];
  safetyAnalysis: {
    highRiskSegments: Array<{
      start: { latitude: number; longitude: number };
      end: { latitude: number; longitude: number };
      riskLevel: 'low' | 'medium' | 'high';
      issues: string[];
    }>;
    safeWalkingTips: string[];
    alternativeRoutes: Array<{
      description: string;
      safetyImprovement: number;
      additionalDistance: number;
    }>;
  };
}

export interface RouteComparison {
  routes: WalkingRoute[];
  recommendation: {
    bestRoute: WalkingRoute;
    reasoning: string;
    safetyGain: number;
    timeTradeoff: number;
  };
}

class UserLocationSafetyService {
  private currentUserLocation: UserLocation | null = null;
  private activeSafetyBubble: SafetyBubble | null = null;
  private processingQueue: SafetyZone[] = [];
  private isProcessing = false;
  private readonly SAFETY_BUBBLE_RADIUS = 0.5; // 500 meters
  private readonly MAX_CONCURRENT_PROCESSING = 3;
  private readonly PROCESSING_DELAY = 1000; // 1 second between processing

  // Visual state callbacks
  private onZoneStateChange?: (zone: SafetyZone) => void;
  private onBubbleUpdate?: (bubble: SafetyBubble) => void;

  /**
   * Set user location and trigger safety bubble analysis
   */
  async setUserLocation(location: UserLocation): Promise<SafetyBubble> {
    console.log('📍 [SAFETY] User location updated:', location);
    this.currentUserLocation = location;

    // Create safety bubble around user
    const bubble = await this.createSafetyBubble(location);
    this.activeSafetyBubble = bubble;

    // Start processing zones
    this.startZoneProcessing();

    return bubble;
  }

  /**
   * Create safety bubble with nearby camera zones
   */
  private async createSafetyBubble(location: UserLocation): Promise<SafetyBubble> {
    console.log('🔮 [SAFETY] Creating safety bubble...');
    
    // Get nearby cameras
    const nearbyCameras = await nycCameraService.getCamerasNearLocation(
      location.latitude,
      location.longitude,
      this.SAFETY_BUBBLE_RADIUS
    );

    // Get Manhattan territories (camera zones)
    const territories = await nycCameraService.getManhattanTerritories();

    // Create safety zones
    const zones: SafetyZone[] = nearbyCameras.map(camera => {
      const territory = territories.find(t => t.cameraId === camera.id);
      const distance = this.calculateDistance(
        location.latitude, location.longitude,
        camera.latitude, camera.longitude
      );

             return {
         id: `zone_${camera.id}`,
         camera,
         territory: territory!,
         distanceFromUser: distance,
         processingState: 'queued' as const,
         visualState: 'sakura_pink' as const
       };
    }).filter(zone => zone.territory); // Only zones with territories

    // Sort by distance (closest first)
    zones.sort((a, b) => a.distanceFromUser - b.distanceFromUser);

    const bubble: SafetyBubble = {
      id: `bubble_${Date.now()}`,
      centerLocation: location,
      radius: this.SAFETY_BUBBLE_RADIUS,
      zones,
      overallSafetyScore: 5, // Will be calculated as zones complete
      completionPercentage: 0,
      isComplete: false,
      processingStartTime: new Date()
    };

    console.log(`🔮 [SAFETY] Safety bubble created with ${zones.length} zones`);
    return bubble;
  }

  /**
   * Start processing zones in the safety bubble
   */
  private async startZoneProcessing(): Promise<void> {
    if (!this.activeSafetyBubble || this.isProcessing) return;

    this.isProcessing = true;
    console.log('⚡ [SAFETY] Starting zone processing...');

    const zones = this.activeSafetyBubble.zones.filter(z => z.processingState === 'queued');
    
    // Process zones in batches
    for (let i = 0; i < zones.length; i += this.MAX_CONCURRENT_PROCESSING) {
      const batch = zones.slice(i, i + this.MAX_CONCURRENT_PROCESSING);
      
      // Process batch in parallel
      const promises = batch.map(zone => this.processZone(zone));
      await Promise.allSettled(promises);
      
      // Update bubble completion
      this.updateBubbleCompletion();
      
      // Delay between batches
      if (i + this.MAX_CONCURRENT_PROCESSING < zones.length) {
        await this.delay(this.PROCESSING_DELAY);
      }
    }

    this.isProcessing = false;
    console.log('✅ [SAFETY] Zone processing completed');
  }

  /**
   * Process individual safety zone
   */
  private async processZone(zone: SafetyZone): Promise<void> {
    try {
      console.log(`🔄 [SAFETY] Processing zone ${zone.id}...`);
      
      // Update visual state to blinking
      zone.processingState = 'processing';
      zone.visualState = 'blinking';
      this.notifyZoneStateChange(zone);

      // Run camera analysis
      const analysis = await nycCameraService.analyzeCameraRisk(zone.camera, undefined, true);
      
      // Update zone with results
      zone.safetyScore = analysis.riskScore;
      zone.processingState = 'completed';
      zone.visualState = 'heat_color';
      zone.lastUpdated = new Date();

      console.log(`✅ [SAFETY] Zone ${zone.id} completed with score ${zone.safetyScore}/10`);
      
    } catch (error) {
      console.error(`❌ [SAFETY] Zone ${zone.id} processing failed:`, error);
      zone.processingState = 'error';
      zone.visualState = 'error_red';
    }

    this.notifyZoneStateChange(zone);
  }

  /**
   * Update safety bubble completion status
   */
  private updateBubbleCompletion(): void {
    if (!this.activeSafetyBubble) return;

    const zones = this.activeSafetyBubble.zones;
    const completedZones = zones.filter(z => z.processingState === 'completed');
    const completionPercentage = (completedZones.length / zones.length) * 100;

    // Calculate overall safety score
    const scores = completedZones
      .filter(z => z.safetyScore !== undefined)
      .map(z => z.safetyScore!);
    
    const overallSafetyScore = scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 5;

    this.activeSafetyBubble.completionPercentage = completionPercentage;
    this.activeSafetyBubble.overallSafetyScore = overallSafetyScore;
    this.activeSafetyBubble.isComplete = completionPercentage === 100;

    if (this.activeSafetyBubble.isComplete) {
      this.activeSafetyBubble.estimatedCompletionTime = new Date();
    }

    console.log(`📊 [SAFETY] Bubble completion: ${Math.round(completionPercentage)}%, Safety: ${overallSafetyScore.toFixed(1)}/10`);
    
    this.notifyBubbleUpdate(this.activeSafetyBubble);
  }

  /**
   * Analyze walking routes with safety scoring
   */
  async analyzeWalkingRoutes(
    destination: { latitude: number; longitude: number },
    maxRoutes: number = 3
  ): Promise<RouteComparison> {
    if (!this.currentUserLocation) {
      throw new Error('User location not set');
    }

    console.log('🚶 [ROUTES] Analyzing walking routes...');
    console.log(`📍 [ROUTES] From: ${this.currentUserLocation.latitude}, ${this.currentUserLocation.longitude}`);
    console.log(`🎯 [ROUTES] To: ${destination.latitude}, ${destination.longitude}`);

    // Generate multiple route options
    const routes = await this.generateRouteOptions(this.currentUserLocation, destination, maxRoutes);
    
    // Analyze safety for each route
    const analyzedRoutes = await Promise.all(
      routes.map(route => this.analyzeRouteSafety(route))
    );

    // Find best route
    const bestRoute = this.selectBestRoute(analyzedRoutes);

    const comparison: RouteComparison = {
      routes: analyzedRoutes,
      recommendation: {
        bestRoute,
        reasoning: this.generateRouteRecommendationReasoning(bestRoute, analyzedRoutes),
        safetyGain: this.calculateSafetyGain(bestRoute, analyzedRoutes),
        timeTradeoff: this.calculateTimeTradeoff(bestRoute, analyzedRoutes)
      }
    };

    console.log(`🎯 [ROUTES] Best route selected with safety score: ${bestRoute.safetyScore}/10`);
    return comparison;
  }

  /**
   * Generate multiple route options
   */
  private async generateRouteOptions(
    start: UserLocation,
    end: { latitude: number; longitude: number },
    maxRoutes: number
  ): Promise<WalkingRoute[]> {
    const routes: WalkingRoute[] = [];

    // Direct route
    routes.push({
      id: 'direct',
      startLocation: start,
      endLocation: end,
      waypoints: [{ latitude: start.latitude, longitude: start.longitude }, end],
      totalDistance: this.calculateDistance(start.latitude, start.longitude, end.latitude, end.longitude),
      estimatedWalkTime: 0,
      safetyScore: 0,
      camerasOnRoute: [],
      safetyAnalysis: {
        highRiskSegments: [],
        safeWalkingTips: [],
        alternativeRoutes: []
      }
    });

    // TODO: Generate alternative routes using different heuristics
    // - Avoid high-traffic areas
    // - Prefer well-lit streets
    // - Use park paths when available
    // - Avoid construction zones

    return routes.slice(0, maxRoutes);
  }

  /**
   * Analyze safety for a specific route
   */
  private async analyzeRouteSafety(route: WalkingRoute): Promise<WalkingRoute> {
    console.log(`🔍 [ROUTES] Analyzing safety for route: ${route.id}`);

    // Get cameras along the route
    const camerasOnRoute = await this.getCamerasAlongRoute(route);
    route.camerasOnRoute = camerasOnRoute;

    // Analyze each camera for safety
    const safetyScores: number[] = [];
    for (const camera of camerasOnRoute) {
      try {
        const analysis = await dataSourceService.debugAnalysis(
          camera.latitude,
          camera.longitude,
          1 // Assume 1 bicycle for route analysis
        );
        safetyScores.push(analysis.safetyScore);
      } catch (error) {
        console.warn(`⚠️ [ROUTES] Failed to analyze camera ${camera.id}:`, error);
        safetyScores.push(5); // Default neutral score
      }
    }

    // Calculate overall route safety score
    route.safetyScore = safetyScores.length > 0
      ? safetyScores.reduce((sum, score) => sum + score, 0) / safetyScores.length
      : 5;

    // Estimate walking time (3 mph average)
    route.estimatedWalkTime = (route.totalDistance * 1000) / (3 * 1609.34 / 60); // minutes

    console.log(`📊 [ROUTES] Route ${route.id} safety score: ${route.safetyScore.toFixed(1)}/10`);
    return route;
  }

  /**
   * Get cameras along a route
   */
  private async getCamerasAlongRoute(route: WalkingRoute): Promise<NYCCamera[]> {
    const allCameras = await nycCameraService.fetchCameras();
    const routeCameras: NYCCamera[] = [];
    const ROUTE_BUFFER = 0.1; // 100 meters on each side

    for (let i = 0; i < route.waypoints.length - 1; i++) {
      const start = route.waypoints[i];
      const end = route.waypoints[i + 1];

      // Find cameras near this segment
      const segmentCameras = allCameras.filter(camera => {
        const distanceToSegment = this.distanceToLineSegment(
          { lat: camera.latitude, lon: camera.longitude },
          { lat: start.latitude, lon: start.longitude },
          { lat: end.latitude, lon: end.longitude }
        );
        return distanceToSegment <= ROUTE_BUFFER;
      });

      routeCameras.push(...segmentCameras);
    }

    // Remove duplicates
    const uniqueCameras = routeCameras.filter((camera, index, self) =>
      index === self.findIndex(c => c.id === camera.id)
    );

    return uniqueCameras;
  }

  /**
   * Select best route based on safety and time
   */
  private selectBestRoute(routes: WalkingRoute[]): WalkingRoute {
    // Weight safety more heavily than time
    const scoredRoutes = routes.map(route => ({
      route,
      score: (route.safetyScore * 0.7) + ((10 - route.estimatedWalkTime / 10) * 0.3)
    }));

    scoredRoutes.sort((a, b) => b.score - a.score);
    return scoredRoutes[0].route;
  }

  // Utility methods
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

  private distanceToLineSegment(
    point: { lat: number; lon: number },
    lineStart: { lat: number; lon: number },
    lineEnd: { lat: number; lon: number }
  ): number {
    // Simplified distance calculation - in production, use proper geometric calculation
    const distToStart = this.calculateDistance(point.lat, point.lon, lineStart.lat, lineStart.lon);
    const distToEnd = this.calculateDistance(point.lat, point.lon, lineEnd.lat, lineEnd.lon);
    return Math.min(distToStart, distToEnd);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRouteRecommendationReasoning(bestRoute: WalkingRoute, allRoutes: WalkingRoute[]): string {
    const avgSafety = allRoutes.reduce((sum, r) => sum + r.safetyScore, 0) / allRoutes.length;
    const safetyAdvantage = bestRoute.safetyScore - avgSafety;
    
    if (safetyAdvantage > 1) {
      return `This route is significantly safer (${safetyAdvantage.toFixed(1)} points above average) with well-lit areas and good visibility.`;
    } else if (safetyAdvantage > 0.5) {
      return `This route offers better safety with fewer risk factors and more pedestrian-friendly infrastructure.`;
    } else {
      return `This route provides the best balance of safety and convenience for your journey.`;
    }
  }

  private calculateSafetyGain(bestRoute: WalkingRoute, allRoutes: WalkingRoute[]): number {
    const avgSafety = allRoutes.reduce((sum, r) => sum + r.safetyScore, 0) / allRoutes.length;
    return bestRoute.safetyScore - avgSafety;
  }

  private calculateTimeTradeoff(bestRoute: WalkingRoute, allRoutes: WalkingRoute[]): number {
    const fastestTime = Math.min(...allRoutes.map(r => r.estimatedWalkTime));
    return bestRoute.estimatedWalkTime - fastestTime;
  }

  // Event handlers
  setOnZoneStateChange(callback: (zone: SafetyZone) => void): void {
    this.onZoneStateChange = callback;
  }

  setOnBubbleUpdate(callback: (bubble: SafetyBubble) => void): void {
    this.onBubbleUpdate = callback;
  }

  private notifyZoneStateChange(zone: SafetyZone): void {
    if (this.onZoneStateChange) {
      this.onZoneStateChange(zone);
    }
  }

  private notifyBubbleUpdate(bubble: SafetyBubble): void {
    if (this.onBubbleUpdate) {
      this.onBubbleUpdate(bubble);
    }
  }

  // Public getters
  getCurrentSafetyBubble(): SafetyBubble | null {
    return this.activeSafetyBubble;
  }

  getCurrentUserLocation(): UserLocation | null {
    return this.currentUserLocation;
  }
}

export default new UserLocationSafetyService(); 