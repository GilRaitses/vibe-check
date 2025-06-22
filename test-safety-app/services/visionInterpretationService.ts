// Vision Interpretation Service
// Post-processing for raw vision data with territory integration

import { RawVisionResponse } from '../config/visionConfig';
import asyncStorageService from './asyncStorageService';
import type { CameraMetadata } from './asyncStorageService';

export interface InterpretedAnalysis {
  // Core metrics
  safetyScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  
  // Derived quantities
  activeCycling: number;        // Active bikes (street + bike_lane + crosswalk)
  pedestrianSafety: number;     // Sidewalk safety for pedestrians
  trafficPressure: number;      // Vehicle congestion impact
  infrastructureQuality: number; // Overall infrastructure score
  
  // Multi-variable conditions
  bikeConflictZones: number;    // Bikes in dangerous positions
  pedestrianExposure: number;   // People in vulnerable positions
  emergencyRisk: number;        // Construction/emergency activity risk
  
  // Time-dependent factors
  rushHourMultiplier: number;
  weatherRisk: number;
  visibilityFactor: number;
  
  // Territory integration
  territoryId: string;
  neighboringRisk: number;      // Risk from adjacent territories
  historicalTrend: number;      // Change from historical average
  
  // Global impact
  globalRiskContribution: number; // How this affects city-wide safety
  
  timestamp: number;
}

export class VisionInterpretationService {
  private asyncStorage = asyncStorageService;
  
  /**
   * Main interpretation function - converts raw vision to actionable intelligence
   */
  async interpretVisionData(
    rawVision: RawVisionResponse,
    territoryId: string,
    cameraId: string,
    coordinates: { lat: number; lng: number }
  ): Promise<InterpretedAnalysis> {
    
    // Get external context
    const [externalData, territoryData, historicalData] = await Promise.all([
      this.dataSource.getExternalData(coordinates.lat, coordinates.lng),
      this.asyncStorage.getCameraMetadata(cameraId),
      this.asyncStorage.getHistoricalAnalysis(territoryId)
    ]);
    
    // Core metric calculations
    const activeCycling = this.calculateActiveCycling(rawVision);
    const pedestrianSafety = this.calculatePedestrianSafety(rawVision);
    const trafficPressure = this.calculateTrafficPressure(rawVision);
    const infrastructureQuality = this.calculateInfrastructureQuality(rawVision);
    
    // Multi-variable condition analysis
    const bikeConflictZones = this.calculateBikeConflictZones(rawVision);
    const pedestrianExposure = this.calculatePedestrianExposure(rawVision);
    const emergencyRisk = this.calculateEmergencyRisk(rawVision);
    
    // Time-dependent factors
    const rushHourMultiplier = this.calculateRushHourMultiplier(externalData.timeData);
    const weatherRisk = this.calculateWeatherRisk(externalData.weatherData);
    const visibilityFactor = this.calculateVisibilityFactor(externalData.weatherData, externalData.timeData);
    
    // Territory integration
    const neighboringRisk = await this.calculateNeighboringRisk(territoryId, coordinates);
    const historicalTrend = this.calculateHistoricalTrend(historicalData, {
      activeCycling,
      pedestrianSafety,
      trafficPressure
    });
    
    // Calculate base safety score
    let safetyScore = 10.0;
    safetyScore -= (activeCycling * 1.5);
    safetyScore -= (bikeConflictZones * 2.0);
    safetyScore -= (pedestrianExposure * 1.2);
    safetyScore -= (trafficPressure * 0.8);
    safetyScore -= (emergencyRisk * 1.8);
    safetyScore += (infrastructureQuality * 0.5);
    safetyScore += (pedestrianSafety * 0.3);
    
    // Apply time-dependent multipliers
    safetyScore *= rushHourMultiplier;
    safetyScore *= weatherRisk;
    safetyScore *= visibilityFactor;
    
    // Apply territorial context
    safetyScore += (historicalTrend * 0.2);
    safetyScore -= (neighboringRisk * 0.3);
    
    // Clamp to valid range
    safetyScore = Math.max(0, Math.min(10, safetyScore));
    
    const riskLevel = this.getRiskLevel(safetyScore);
    const globalRiskContribution = this.calculateGlobalRiskContribution(
      safetyScore, 
      territoryData?.territory?.area || 1000
    );
    
    const interpretation: InterpretedAnalysis = {
      safetyScore,
      riskLevel,
      activeCycling,
      pedestrianSafety,
      trafficPressure,
      infrastructureQuality,
      bikeConflictZones,
      pedestrianExposure,
      emergencyRisk,
      rushHourMultiplier,
      weatherRisk,
      visibilityFactor,
      territoryId,
      neighboringRisk,
      historicalTrend,
      globalRiskContribution,
      timestamp: Date.now()
    };
    
    // Update AsyncStorage with new analysis
    await this.updateStorageWithAnalysis(cameraId, territoryId, interpretation, rawVision);
    
    return interpretation;
  }
  
  /**
   * Calculate active cycling activity (bikes in motion/dangerous positions)
   */
  private calculateActiveCycling(vision: RawVisionResponse): number {
    return (
      vision.bikes_street * 1.5 +      // High risk
      vision.bikes_bike_lane * 0.8 +   // Medium risk  
      vision.bikes_crosswalk * 2.0 +   // Very high risk
      vision.activity_cycling * 1.2    // General cycling activity
    ) / 4;
  }
  
  /**
   * Calculate pedestrian safety level
   */
  private calculatePedestrianSafety(vision: RawVisionResponse): number {
    const sidewalkSafety = Math.max(0, 4 - vision.people_street); // Fewer people in street = safer
    const infrastructureBonus = vision.infrastructure_signals + vision.infrastructure_signs;
    return (sidewalkSafety + infrastructureBonus * 0.5) / 2;
  }
  
  /**
   * Calculate traffic pressure/congestion
   */
  private calculateTrafficPressure(vision: RawVisionResponse): number {
    return (
      vision.vehicles_moving * 0.8 +
      vision.vehicles_stopped * 1.2 +    // Stopped traffic is worse
      vision.vehicles_blocking * 2.0 +   // Blocking is very bad
      vision.activity_traffic * 1.0
    ) / 4;
  }
  
  /**
   * Calculate overall infrastructure quality
   */
  private calculateInfrastructureQuality(vision: RawVisionResponse): number {
    return (
      vision.infrastructure_signals +
      vision.infrastructure_signs +
      vision.infrastructure_lanes +
      vision.infrastructure_barriers +
      vision.infrastructure_lighting
    ) / 5;
  }
  
  /**
   * Detect bike conflict zones (bikes in dangerous positions relative to traffic)
   */
  private calculateBikeConflictZones(vision: RawVisionResponse): number {
    const bikeTrafficConflict = Math.min(vision.bikes_street, vision.vehicles_moving) * 2;
    const crosswalkConflict = vision.bikes_crosswalk * vision.vehicles_turning;
    const blockingConflict = vision.bikes_parked * vision.vehicles_blocking;
    
    return (bikeTrafficConflict + crosswalkConflict + blockingConflict) / 3;
  }
  
  /**
   * Calculate pedestrian exposure to risk
   */
  private calculatePedestrianExposure(vision: RawVisionResponse): number {
    const streetExposure = vision.people_street * 2.0;
    const crosswalkRisk = vision.people_crosswalk * vision.vehicles_turning;
    const waitingRisk = vision.people_waiting * vision.vehicles_moving * 0.5;
    
    return (streetExposure + crosswalkRisk + waitingRisk) / 3;
  }
  
  /**
   * Calculate emergency/construction risk
   */
  private calculateEmergencyRisk(vision: RawVisionResponse): number {
    return vision.activity_construction * 1.5 + vision.activity_emergency * 2.0;
  }
  
  /**
   * Calculate rush hour multiplier
   */
  private calculateRushHourMultiplier(timeData: any): number {
    if (!timeData) return 1.0;
    
    const hour = timeData.currentHour;
    const isWeekend = timeData.isWeekend;
    
    if (isWeekend) return 0.9; // Weekends are generally safer
    
    // Rush hour periods are riskier
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      return 1.3;
    }
    
    // Late night is also riskier due to visibility
    if (hour >= 22 || hour <= 5) {
      return 1.2;
    }
    
    return 1.0;
  }
  
  /**
   * Calculate weather-based risk multiplier
   */
  private calculateWeatherRisk(weatherData: any): number {
    if (!weatherData) return 1.0;
    
    let multiplier = 1.0;
    
    // Rain/snow increases risk
    if (weatherData.precipitation > 0) {
      multiplier += weatherData.precipitation * 0.3;
    }
    
    // High winds increase risk
    if (weatherData.windSpeed > 15) {
      multiplier += 0.2;
    }
    
    // Poor visibility increases risk
    if (weatherData.visibility < 5) {
      multiplier += 0.3;
    }
    
    return Math.min(2.0, multiplier); // Cap at 2x risk
  }
  
  /**
   * Calculate visibility factor
   */
  private calculateVisibilityFactor(weatherData: any, timeData: any): number {
    let factor = 1.0;
    
    // Night time reduces visibility
    if (timeData?.currentHour >= 20 || timeData?.currentHour <= 6) {
      factor *= 1.2;
    }
    
    // Weather affects visibility
    if (weatherData?.visibility < 10) {
      factor *= (1 + (10 - weatherData.visibility) * 0.1);
    }
    
    return Math.min(1.5, factor);
  }
  
  /**
   * Calculate risk from neighboring territories
   */
  private async calculateNeighboringRisk(territoryId: string, coordinates: { lat: number; lng: number }): Promise<number> {
    const dataset = await this.asyncStorage.getCameraDataset();
    if (!dataset) return 0;
    
    // Find neighboring territories within 200m
    const neighbors = Object.values(dataset.cameras).filter(camera => {
      if (!camera.territory) return false;
      const distance = this.calculateDistance(
        coordinates.lat, coordinates.lng,
        camera.lat, camera.lng
      );
      return distance <= 200 && camera.territory.id !== territoryId;
    });
    
    if (neighbors.length === 0) return 0;
    
    // Average risk from neighbors
    const avgNeighborRisk = neighbors.reduce((sum, camera) => {
      const lastAnalysis = camera.analysisHistory[camera.analysisHistory.length - 1];
      return sum + (lastAnalysis?.safetyScore || 5);
    }, 0) / neighbors.length;
    
    // Convert to risk (lower safety = higher risk)
    return Math.max(0, 5 - avgNeighborRisk);
  }
  
  /**
   * Calculate historical trend
   */
  private calculateHistoricalTrend(historicalData: any, currentMetrics: any): number {
    if (!historicalData || historicalData.length < 2) return 0;
    
    const recent = historicalData.slice(-5); // Last 5 analyses
    const avgHistorical = recent.reduce((sum: number, analysis: any) => 
      sum + (analysis.safetyScore || 5), 0) / recent.length;
    
    const currentScore = 10 - (currentMetrics.activeCycling + currentMetrics.trafficPressure);
    
    // Positive trend = improving safety
    return (currentScore - avgHistorical) / 2;
  }
  
  /**
   * Calculate global risk contribution
   */
  private calculateGlobalRiskContribution(safetyScore: number, territoryArea: number): number {
    const riskScore = 10 - safetyScore;
    const areaWeight = Math.min(1, territoryArea / 5000); // Normalize by area
    return riskScore * areaWeight;
  }
  
  /**
   * Get risk level from safety score
   */
  private getRiskLevel(safetyScore: number): 'low' | 'moderate' | 'high' | 'critical' {
    if (safetyScore >= 7) return 'low';
    if (safetyScore >= 5) return 'moderate';
    if (safetyScore >= 3) return 'high';
    return 'critical';
  }
  
  /**
   * Update AsyncStorage with new analysis
   */
  private async updateStorageWithAnalysis(
    cameraId: string,
    territoryId: string,
    interpretation: InterpretedAnalysis,
    rawVision: RawVisionResponse
  ): Promise<void> {
    
    // Add to camera's analysis history
    await this.asyncStorage.addAnalysisResult(cameraId, {
      timestamp: interpretation.timestamp,
      safetyScore: interpretation.safetyScore,
      riskLevel: interpretation.riskLevel,
      rawVisionData: rawVision,
      interpretedData: interpretation
    });
    
    // Update global statistics
    const dataset = await this.asyncStorage.getCameraDataset();
    if (dataset) {
      dataset.globalStats.totalAnalyses++;
      dataset.globalStats.avgSafetyScore = (
        (dataset.globalStats.avgSafetyScore * (dataset.globalStats.totalAnalyses - 1)) +
        interpretation.safetyScore
      ) / dataset.globalStats.totalAnalyses;
      
      dataset.globalStats.lastUpdated = interpretation.timestamp;
      
      await this.asyncStorage.saveCameraDataset(dataset);
    }
  }
  
  /**
   * Calculate distance between two coordinates
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
} 