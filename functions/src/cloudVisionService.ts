/**
 * GOOGLE CLOUD VISION SERVICE FOR NYC CAMERA ANALYSIS
 * 
 * Uses Google Cloud Vision API to analyze real NYC traffic camera feeds
 * Detects: pedestrians, bicycles, vehicles, traffic density, infrastructure
 * Returns numerical data compatible with our ML pipeline
 */

import { ImageAnnotatorClient } from '@google-cloud/vision';

// Initialize Cloud Vision client
const vision = new ImageAnnotatorClient();

export interface CloudVisionAnalysis {
  // Core detection counts
  pedestrian_count: number;
  bicycle_count: number;
  vehicle_count: number;
  motorcycle_count: number;
  
  // Traffic analysis
  traffic_density: 'low' | 'medium' | 'high';
  congestion_level: number; // 0-4 scale
  
  // Safety factors
  sidewalk_visible: boolean;
  bike_lane_visible: boolean;
  crosswalk_visible: boolean;
  traffic_signals_visible: boolean;
  
  // Risk assessment
  pedestrian_bike_interaction: number; // 0-4 scale
  overall_safety_score: number; // 1-10 scale (10 = safest)
  
  // Confidence metrics
  detection_confidence: number;
  analysis_confidence: number;
  
  // Raw data for ML
  numerical_data: number[]; // 17-element array for ML compatibility
}

export interface CloudVisionRawDetection {
  objects: Array<{
    name: string;
    confidence: number;
    boundingPoly: any;
  }>;
  labels: Array<{
    description: string;
    score: number;
  }>;
  text: Array<{
    description: string;
    confidence: number;
  }>;
}

class CloudVisionService {
  
  /**
   * Analyze NYC traffic camera image for safety conditions
   */
  async analyzeCameraFeed(imageUrl: string): Promise<CloudVisionAnalysis> {
    console.log(`🔍 [CLOUD_VISION] Starting analysis of camera feed: ${imageUrl}`);
    
    try {
      // Download and analyze image
      const rawDetections = await this.performVisionAnalysis(imageUrl);
      
      // Process detections into safety analysis
      const analysis = await this.processSafetyAnalysis(rawDetections);
      
      console.log(`✅ [CLOUD_VISION] Analysis completed - Safety Score: ${analysis.overall_safety_score}/10`);
      console.log(`📊 [CLOUD_VISION] Detections: ${analysis.pedestrian_count} pedestrians, ${analysis.bicycle_count} bikes, ${analysis.vehicle_count} vehicles`);
      
      return analysis;
      
    } catch (error) {
      console.error(`❌ [CLOUD_VISION] Analysis failed:`, error);
      throw error;
    }
  }
  
  /**
   * Perform raw Cloud Vision API analysis
   */
  private async performVisionAnalysis(imageUrl: string): Promise<CloudVisionRawDetection> {
    console.log(`🤖 [CLOUD_VISION] Calling Google Cloud Vision API...`);
    
    const request = {
      image: { source: { imageUri: imageUrl } },
      features: [
        { type: 'OBJECT_LOCALIZATION', maxResults: 50 },
        { type: 'LABEL_DETECTION', maxResults: 20 },
        { type: 'TEXT_DETECTION', maxResults: 10 }
      ]
    };
    
    const [result] = await vision.annotateImage(request);
    
    const objects = result.localizedObjectAnnotations || [];
    const labels = result.labelAnnotations || [];
    const textAnnotations = result.textAnnotations || [];
    
    console.log(`📊 [CLOUD_VISION] Raw detections: ${objects.length} objects, ${labels.length} labels, ${textAnnotations.length} text elements`);
    
    return {
      objects: objects.map(obj => ({
        name: obj.name || '',
        confidence: obj.score || 0,
        boundingPoly: obj.boundingPoly
      })),
      labels: labels.map(label => ({
        description: label.description || '',
        score: label.score || 0
      })),
      text: textAnnotations.map(text => ({
        description: text.description || '',
        confidence: 1.0 // Text detection doesn't provide confidence
      }))
    };
  }
  
  /**
   * Process raw detections into safety analysis
   */
  private async processSafetyAnalysis(detections: CloudVisionRawDetection): Promise<CloudVisionAnalysis> {
    console.log(`🔬 [CLOUD_VISION] Processing ${detections.objects.length} objects for safety analysis...`);
    
    // Count key objects
    const pedestrians = this.countObjects(detections.objects, ['Person', 'Human', 'Pedestrian']);
    const bicycles = this.countObjects(detections.objects, ['Bicycle', 'Bike']);
    const vehicles = this.countObjects(detections.objects, ['Car', 'Vehicle', 'Truck', 'Bus', 'Van']);
    const motorcycles = this.countObjects(detections.objects, ['Motorcycle', 'Motorbike']);
    
    // Analyze labels for context
    const streetLabels = this.analyzeLabels(detections.labels);
    
    // Calculate traffic density
    const totalMovingObjects = pedestrians + bicycles + vehicles + motorcycles;
    const trafficDensity = this.calculateTrafficDensity(totalMovingObjects, detections.labels);
    
    // Assess infrastructure visibility
    const infrastructure = this.assessInfrastructure(detections.labels, detections.text);
    
    // Calculate risk factors
    const pedestrianBikeInteraction = this.calculateInteractionRisk(pedestrians, bicycles, streetLabels);
    const overallSafetyScore = this.calculateSafetyScore({
      pedestrians,
      bicycles,
      vehicles,
      trafficDensity,
      infrastructure,
      pedestrianBikeInteraction
    });
    
    // Generate numerical data array (17 elements for ML compatibility)
    const numericalData = this.generateNumericalArray({
      pedestrians,
      bicycles,
      vehicles,
      motorcycles,
      trafficDensity,
      infrastructure,
      overallSafetyScore,
      pedestrianBikeInteraction
    });
    
    const analysis: CloudVisionAnalysis = {
      pedestrian_count: pedestrians,
      bicycle_count: bicycles,
      vehicle_count: vehicles,
      motorcycle_count: motorcycles,
      traffic_density: trafficDensity,
      congestion_level: Math.min(Math.floor(totalMovingObjects / 3), 4),
      sidewalk_visible: infrastructure.sidewalk,
      bike_lane_visible: infrastructure.bikeLane,
      crosswalk_visible: infrastructure.crosswalk,
      traffic_signals_visible: infrastructure.trafficSignals,
      pedestrian_bike_interaction: pedestrianBikeInteraction,
      overall_safety_score: overallSafetyScore,
      detection_confidence: this.calculateDetectionConfidence(detections.objects),
      analysis_confidence: 0.85, // Cloud Vision is generally reliable
      numerical_data: numericalData
    };
    
    console.log(`📋 [CLOUD_VISION] Safety analysis completed:`);
    console.log(`   🚶 Pedestrians: ${pedestrians}`);
    console.log(`   🚴 Bicycles: ${bicycles}`);
    console.log(`   🚗 Vehicles: ${vehicles}`);
    console.log(`   🚦 Traffic Density: ${trafficDensity}`);
    console.log(`   ⚠️ Pedestrian-Bike Risk: ${pedestrianBikeInteraction}/4`);
    console.log(`   🎯 Safety Score: ${overallSafetyScore}/10`);
    
    return analysis;
  }
  
  /**
   * Count objects of specific types
   */
  private countObjects(objects: any[], targetTypes: string[]): number {
    return objects.filter(obj => 
      targetTypes.some(type => 
        obj.name.toLowerCase().includes(type.toLowerCase())
      ) && obj.confidence > 0.5
    ).length;
  }
  
  /**
   * Analyze scene labels for context
   */
  private analyzeLabels(labels: any[]): {
    isStreet: boolean;
    isIntersection: boolean;
    hasSidewalk: boolean;
    hasTraffic: boolean;
  } {
    const labelTexts = labels.map(l => l.description.toLowerCase());
    
    return {
      isStreet: labelTexts.some(l => ['street', 'road', 'avenue', 'boulevard'].some(s => l.includes(s))),
      isIntersection: labelTexts.some(l => ['intersection', 'crosswalk', 'crossing'].some(s => l.includes(s))),
      hasSidewalk: labelTexts.some(l => ['sidewalk', 'pavement', 'walkway'].some(s => l.includes(s))),
      hasTraffic: labelTexts.some(l => ['traffic', 'congestion', 'busy'].some(s => l.includes(s)))
    };
  }
  
  /**
   * Analyze text for traffic signs and infrastructure
   * TODO: Integrate with main analysis when needed
   */
  /*
  private analyzeText(textElements: any[]): {
    stopSign: boolean;
    yieldSign: boolean;
    bikeRoute: boolean;
    noParking: boolean;
  } {
    const allText = textElements.map(t => t.description.toLowerCase()).join(' ');
    
    return {
      stopSign: allText.includes('stop'),
      yieldSign: allText.includes('yield'),
      bikeRoute: allText.includes('bike') || allText.includes('bicycle'),
      noParking: allText.includes('no parking') || allText.includes('no stopping')
    };
  }
  */
  
  /**
   * Calculate traffic density
   */
  private calculateTrafficDensity(objectCount: number, labels: any[]): 'low' | 'medium' | 'high' {
    const hasTrafficLabel = labels.some(l => 
      ['traffic', 'congestion', 'busy', 'crowded'].some(keyword => 
        l.description.toLowerCase().includes(keyword)
      )
    );
    
    if (objectCount >= 15 || hasTrafficLabel) return 'high';
    if (objectCount >= 8) return 'medium';
    return 'low';
  }
  
  /**
   * Assess infrastructure visibility
   */
  private assessInfrastructure(labels: any[], textElements: any[]): {
    sidewalk: boolean;
    bikeLane: boolean;
    crosswalk: boolean;
    trafficSignals: boolean;
  } {
    const labelTexts = labels.map(l => l.description.toLowerCase());
    const allText = textElements.map(t => t.description.toLowerCase()).join(' ');
    
    return {
      sidewalk: labelTexts.some(l => ['sidewalk', 'pavement', 'walkway'].some(s => l.includes(s))),
      bikeLane: labelTexts.some(l => ['bike', 'bicycle'].some(s => l.includes(s))) || allText.includes('bike'),
      crosswalk: labelTexts.some(l => ['crosswalk', 'crossing', 'intersection'].some(s => l.includes(s))),
      trafficSignals: labelTexts.some(l => ['traffic light', 'signal', 'stop light'].some(s => l.includes(s)))
    };
  }
  
  /**
   * Calculate pedestrian-bike interaction risk
   */
  private calculateInteractionRisk(pedestrians: number, bicycles: number, context: any): number {
    if (pedestrians === 0 || bicycles === 0) return 0;
    
    // Higher risk when both pedestrians and bikes are present
    const baseRisk = Math.min(pedestrians * bicycles / 2, 4);
    
    // Increase risk if it's a street/intersection without clear separation
    const contextMultiplier = context.isStreet && !context.hasSidewalk ? 1.5 : 1.0;
    
    return Math.min(Math.round(baseRisk * contextMultiplier), 4);
  }
  
  /**
   * Calculate overall safety score
   */
  private calculateSafetyScore(factors: {
    pedestrians: number;
    bicycles: number;
    vehicles: number;
    trafficDensity: 'low' | 'medium' | 'high';
    infrastructure: any;
    pedestrianBikeInteraction: number;
  }): number {
    let score = 10; // Start with perfect safety
    
    // Deduct for high pedestrian-bike interaction
    score -= factors.pedestrianBikeInteraction * 1.5;
    
    // Deduct for traffic density
    if (factors.trafficDensity === 'high') score -= 2;
    else if (factors.trafficDensity === 'medium') score -= 1;
    
    // Deduct for high activity without infrastructure
    const totalActivity = factors.pedestrians + factors.bicycles + factors.vehicles;
    if (totalActivity > 10 && !factors.infrastructure.sidewalk) score -= 2;
    if (totalActivity > 10 && !factors.infrastructure.trafficSignals) score -= 1;
    
    // Bonus for good infrastructure
    if (factors.infrastructure.sidewalk && factors.infrastructure.crosswalk) score += 1;
    if (factors.infrastructure.bikeLane) score += 1;
    
    return Math.max(1, Math.min(10, Math.round(score)));
  }
  
  /**
   * Generate 17-element numerical array for ML compatibility
   */
  private generateNumericalArray(data: any): number[] {
    return [
      Math.min(data.pedestrians, 4),                    // 0: pedestrian_walkway_violation proxy
      Math.min(data.bicycles, 4),                       // 1: dangerous_bike_lane_position proxy  
      Math.min(data.pedestrianBikeInteraction, 4),      // 2: bike_red_light_violation proxy
      Math.min(data.pedestrians > 5 ? 3 : 0, 4),       // 3: blocking_pedestrian_flow
      Math.min(data.vehicles > 3 ? 2 : 0, 4),          // 4: car_bike_lane_violation proxy
      Math.min(data.pedestrians, 4),                    // 5: pedestrian_density
      data.infrastructure?.crosswalk ? 1 : 0,           // 6: vulnerable_population proxy
      data.trafficDensity === 'high' ? 4 : data.trafficDensity === 'medium' ? 2 : 1, // 7: traffic_volume
      data.infrastructure?.trafficSignals ? 4 : 2,      // 8: visibility_conditions proxy
      data.pedestrianBikeInteraction,                   // 9: intersection_complexity
      data.infrastructure?.sidewalk ? 0 : 3,            // 10: missing_barriers
      data.infrastructure?.trafficSignals ? 0 : 2,      // 11: poor_signage
      0,                                               // 12: signal_malfunction (can't detect from image)
      Math.min(data.bicycles, 4),                      // 13: cyclist_speed_estimate proxy
      data.pedestrianBikeInteraction >= 3 ? 3 : 0,     // 14: aggressive_behavior proxy
      data.infrastructure?.sidewalk && data.infrastructure?.trafficSignals ? 4 : 2, // 15: infrastructure_quality
      0,                                               // 16: weather_impact (can't detect reliably from image)
    ];
  }
  
  /**
   * Calculate detection confidence based on object detection scores
   */
  private calculateDetectionConfidence(objects: any[]): number {
    if (objects.length === 0) return 0.5;
    
    const avgConfidence = objects.reduce((sum, obj) => sum + obj.confidence, 0) / objects.length;
    return Math.round(avgConfidence * 100) / 100;
  }
}

export default new CloudVisionService(); 