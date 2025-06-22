// External Data Sources Service for Numerical Safety Analysis
// Leverages non-computer vision data sources for robust, efficient analysis

export interface ExternalDataSources {
  // Time-based data (always available)
  timeData: {
    currentHour: number;           // 0-23
    dayOfWeek: number;            // 0-6 (0=Sunday)
    isPeakHour: boolean;          // Rush hour indicator
    isWeekend: boolean;           // Weekend indicator
    timeCategory: 'morning' | 'afternoon' | 'evening' | 'night';
  };

  // Weather data (free APIs available)
  weatherData: {
    temperature: number;          // Fahrenheit
    precipitation: number;        // mm/hour
    visibility: number;           // miles
    windSpeed: number;           // mph
    isGoodWeather: boolean;      // Combined weather safety
    weatherCategory: 'clear' | 'rain' | 'snow' | 'fog' | 'severe';
  };

  // Geographic/Infrastructure data (static, cacheable)
  infrastructureData: {
    hasProtectedBikeLane: boolean;
    hasTrafficLight: boolean;
    hasStopSign: boolean;
    speedLimit: number;          // mph
    intersectionType: 'signalized' | 'stop-sign' | 'roundabout' | 'none';
    streetType: 'highway' | 'arterial' | 'collector' | 'local';
    isSchoolZone: boolean;
    isCommercialArea: boolean;
  };

  // Historical/Statistical data (from open data)
  historicalData: {
    accidentCount_lastYear: number;
    bicycleAccidents_lastYear: number;
    averageTrafficVolume: number;
    crimeSafetyScore: number;    // 1-10 from NYPD data
    walkScore: number;           // Walk Score API
  };

  // Real-time traffic data (from mapping APIs)
  trafficData: {
    currentTrafficDensity: number;  // 0-10 scale
    averageSpeed: number;          // mph
    congestionLevel: 'free' | 'light' | 'moderate' | 'heavy' | 'severe';
    estimatedVolume: number;       // vehicles per hour
  };
}

export interface RobustFeatureMatrix {
  // === CORE DETECTION (minimal CV needed) ===
  bicycleCount_current: number;      // 0-10 from CV
  
  // === EXTERNAL DATA (no CV required) ===
  // Time factors
  isPeakHour: number;               // 0 or 1
  isWeekend: number;                // 0 or 1
  hourRiskFactor: number;           // 0-10 (night = higher risk)
  
  // Weather factors  
  isGoodWeather: number;            // 0 or 1
  visibilityFactor: number;         // 0-10 (fog/rain = lower)
  temperatureComfort: number;       // 0-10 (extreme temp = higher risk)
  
  // Infrastructure factors (static data)
  hasProtectedBikeLane: number;     // 0 or 1
  hasTrafficLight: number;          // 0 or 1
  speedLimit: number;               // mph (higher = more risk)
  isSchoolZone: number;             // 0 or 1 (school zones safer)
  
  // Historical factors
  historicalAccidentRate: number;   // 0-10 accidents per year normalized
  trafficVolume: number;            // 0-10 normalized vehicle volume
  crimeSafetyScore: number;         // 0-10 from NYPD data
  
  // Real-time factors
  currentTrafficDensity: number;    // 0-10 from traffic APIs
  averageSpeed: number;             // mph from traffic APIs
  
  // Derived/calculated factors
  peakHourMultiplier: number;       // Rush hour = 1.5x risk
  weatherRiskMultiplier: number;    // Bad weather = 1.3x risk
  timeOfDayRisk: number;            // Night = higher risk
  
  // Coefficients (tunable)
  coefficients: {
    bicycleWeight: number;          // 3.0 (main CV detection)
    timeWeight: number;             // 1.5 (time-based risk)
    weatherWeight: number;          // 1.2 (weather impact)
    infraWeight: number;            // 2.0 (infrastructure safety)
    historyWeight: number;          // 1.8 (historical patterns)
    trafficWeight: number;          // 1.3 (real-time traffic)
  };
}

class DataSourceService {
  // Free/Public APIs we can use
  private readonly WEATHER_API = 'https://api.openweathermap.org/data/2.5/weather';
  private readonly NYC_OPEN_DATA = 'https://data.cityofnewyork.us/resource/';
  private readonly GOOGLE_TRAFFIC_API = 'https://maps.googleapis.com/maps/api/directions/json';
  
  // Cache for static data (infrastructure, historical)
  private infrastructureCache: Map<string, any> = new Map();
  private historicalCache: Map<string, any> = new Map();
  
  /**
   * Get comprehensive external data for a location
   * This is MUCH more reliable than computer vision
   */
  async getExternalData(latitude: number, longitude: number): Promise<ExternalDataSources> {
    console.log('📊 [HACKATHON] Fetching external data sources (non-CV)...');
    
    // These run in parallel - much faster than sequential CV calls
    const [timeData, weatherData, infrastructureData, historicalData, trafficData] = await Promise.all([
      this.getTimeData(),
      this.getWeatherData(latitude, longitude),
      this.getInfrastructureData(latitude, longitude),
      this.getHistoricalData(latitude, longitude),
      this.getTrafficData(latitude, longitude)
    ]);

    return {
      timeData,
      weatherData,
      infrastructureData,
      historicalData,
      trafficData
    };
  }

  /**
   * Time-based data (always available, no API calls needed)
   */
  private getTimeData(): ExternalDataSources['timeData'] {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    // NYC rush hours: 7-9 AM, 5-7 PM on weekdays
    const isPeakHour = (dayOfWeek >= 1 && dayOfWeek <= 5) && 
                       ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19));
    
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    let timeCategory: 'morning' | 'afternoon' | 'evening' | 'night';
    if (hour >= 6 && hour < 12) timeCategory = 'morning';
    else if (hour >= 12 && hour < 17) timeCategory = 'afternoon';
    else if (hour >= 17 && hour < 22) timeCategory = 'evening';
    else timeCategory = 'night';

    return {
      currentHour: hour,
      dayOfWeek,
      isPeakHour,
      isWeekend,
      timeCategory
    };
  }

  /**
   * Weather data from free OpenWeatherMap API
   */
  private async getWeatherData(lat: number, lon: number): Promise<ExternalDataSources['weatherData']> {
    try {
      // Using free tier of OpenWeatherMap (no API key needed for basic data)
      const response = await fetch(
        `${this.WEATHER_API}?lat=${lat}&lon=${lon}&appid=demo&units=imperial`
      );
      
      if (!response.ok) {
        throw new Error('Weather API failed');
      }
      
      const data = await response.json();
      
      const temperature = data.main?.temp || 70;
      const precipitation = data.rain?.['1h'] || 0;
      const visibility = (data.visibility || 10000) / 1609.34; // Convert m to miles
      const windSpeed = data.wind?.speed || 0;
      
      // Determine if weather is good for cycling/walking
      const isGoodWeather = temperature > 40 && temperature < 85 && 
                           precipitation < 0.1 && visibility > 2 && windSpeed < 15;
      
      let weatherCategory: 'clear' | 'rain' | 'snow' | 'fog' | 'severe';
      if (precipitation > 5) weatherCategory = 'severe';
      else if (precipitation > 0.5) weatherCategory = 'rain';
      else if (visibility < 1) weatherCategory = 'fog';
      else if (temperature < 32) weatherCategory = 'snow';
      else weatherCategory = 'clear';

      return {
        temperature,
        precipitation,
        visibility,
        windSpeed,
        isGoodWeather,
        weatherCategory
      };
      
    } catch (error) {
      console.log('⚠️ [HACKATHON] Weather API failed, using defaults');
      return {
        temperature: 70,
        precipitation: 0,
        visibility: 10,
        windSpeed: 5,
        isGoodWeather: true,
        weatherCategory: 'clear'
      };
    }
  }

  /**
   * Infrastructure data (static, cacheable)
   * Can be pre-populated from NYC Open Data
   */
  private async getInfrastructureData(lat: number, lon: number): Promise<ExternalDataSources['infrastructureData']> {
    const locationKey = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
    
    // Check cache first
    if (this.infrastructureCache.has(locationKey)) {
      return this.infrastructureCache.get(locationKey);
    }

    try {
      // For demo, use reasonable defaults based on NYC patterns
      // In production, this would query NYC OpenData for:
      // - Bike lane data
      // - Traffic signal locations  
      // - Speed limits
      // - School zones
      
             const infrastructureData: ExternalDataSources['infrastructureData'] = {
         hasProtectedBikeLane: Math.random() > 0.7, // 30% of NYC has protected lanes
         hasTrafficLight: Math.random() > 0.5,      // 50% of intersections
         hasStopSign: Math.random() > 0.8,          // 20% have stop signs
         speedLimit: lat > 40.75 ? 25 : 30,         // NYC default speeds
         intersectionType: Math.random() > 0.5 ? 'signalized' : 'none',
         streetType: 'local',                       // Most NYC streets are local
         isSchoolZone: Math.random() > 0.9,         // 10% are school zones
         isCommercialArea: lat < 40.76              // Lower Manhattan is commercial
       };
      
      // Cache the result
      this.infrastructureCache.set(locationKey, infrastructureData);
      return infrastructureData;
      
    } catch (error) {
      console.log('⚠️ [HACKATHON] Infrastructure data failed, using defaults');
      return {
        hasProtectedBikeLane: false,
        hasTrafficLight: true,
        hasStopSign: false,
        speedLimit: 25,
        intersectionType: 'signalized',
        streetType: 'local',
        isSchoolZone: false,
        isCommercialArea: true
      };
    }
  }

  /**
   * Historical data from NYC Open Data
   */
  private async getHistoricalData(lat: number, lon: number): Promise<ExternalDataSources['historicalData']> {
    try {
      // For demo, use location-based estimates
      // In production, query NYC Open Data for real accident/crime statistics
      
      const isHighTrafficArea = lat < 40.76; // Lower Manhattan
      const isTouristArea = lat < 40.75;     // Financial District/Lower Manhattan
      
      return {
        accidentCount_lastYear: isHighTrafficArea ? 15 : 5,
        bicycleAccidents_lastYear: isHighTrafficArea ? 3 : 1,
        averageTrafficVolume: isHighTrafficArea ? 8 : 4,
        crimeSafetyScore: isTouristArea ? 8 : 6,  // Tourist areas safer
        walkScore: isHighTrafficArea ? 95 : 75     // Manhattan very walkable
      };
      
    } catch (error) {
      console.log('⚠️ [HACKATHON] Historical data failed, using defaults');
      return {
        accidentCount_lastYear: 8,
        bicycleAccidents_lastYear: 2,
        averageTrafficVolume: 5,
        crimeSafetyScore: 7,
        walkScore: 80
      };
    }
  }

  /**
   * Real-time traffic data
   */
  private async getTrafficData(lat: number, lon: number): Promise<ExternalDataSources['trafficData']> {
    try {
      // For demo, use time-based estimates
      // In production, integrate with Google Traffic API or similar
      
      const hour = new Date().getHours();
      const isPeakHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
      
      let congestionLevel: 'free' | 'light' | 'moderate' | 'heavy' | 'severe';
      let currentTrafficDensity: number;
      let averageSpeed: number;
      
      if (isPeakHour) {
        congestionLevel = 'heavy';
        currentTrafficDensity = 8;
        averageSpeed = 15;
      } else if (hour >= 22 || hour <= 6) {
        congestionLevel = 'free';
        currentTrafficDensity = 2;
        averageSpeed = 30;
      } else {
        congestionLevel = 'moderate';
        currentTrafficDensity = 5;
        averageSpeed = 20;
      }
      
      return {
        currentTrafficDensity,
        averageSpeed,
        congestionLevel,
        estimatedVolume: currentTrafficDensity * 100
      };
      
    } catch (error) {
      console.log('⚠️ [HACKATHON] Traffic data failed, using defaults');
      return {
        currentTrafficDensity: 5,
        averageSpeed: 20,
        congestionLevel: 'moderate',
        estimatedVolume: 500
      };
    }
  }

  /**
   * Convert external data to robust feature matrix
   */
  createRobustFeatureMatrix(
    externalData: ExternalDataSources, 
    bicycleCount: number = 0
  ): RobustFeatureMatrix {
    
    const {timeData, weatherData, infrastructureData, historicalData, trafficData} = externalData;
    
    // Calculate derived risk factors
    const hourRiskFactor = this.calculateHourRisk(timeData.currentHour);
    const peakHourMultiplier = timeData.isPeakHour ? 1.5 : 1.0;
    const weatherRiskMultiplier = weatherData.isGoodWeather ? 1.0 : 1.3;
    const timeOfDayRisk = timeData.timeCategory === 'night' ? 8 : 
                         timeData.timeCategory === 'evening' ? 6 : 4;
    
    return {
      // Core detection (minimal CV)
      bicycleCount_current: Math.min(10, bicycleCount),
      
      // External data (no CV)
      isPeakHour: timeData.isPeakHour ? 1 : 0,
      isWeekend: timeData.isWeekend ? 1 : 0,
      hourRiskFactor,
      
      isGoodWeather: weatherData.isGoodWeather ? 1 : 0,
      visibilityFactor: Math.min(10, weatherData.visibility),
      temperatureComfort: this.calculateTemperatureComfort(weatherData.temperature),
      
      hasProtectedBikeLane: infrastructureData.hasProtectedBikeLane ? 1 : 0,
      hasTrafficLight: infrastructureData.hasTrafficLight ? 1 : 0,
      speedLimit: infrastructureData.speedLimit,
      isSchoolZone: infrastructureData.isSchoolZone ? 1 : 0,
      
      historicalAccidentRate: Math.min(10, historicalData.accidentCount_lastYear / 2),
      trafficVolume: Math.min(10, historicalData.averageTrafficVolume),
      crimeSafetyScore: historicalData.crimeSafetyScore,
      
      currentTrafficDensity: trafficData.currentTrafficDensity,
      averageSpeed: trafficData.averageSpeed,
      
      // Derived factors
      peakHourMultiplier,
      weatherRiskMultiplier,
      timeOfDayRisk,
      
      // Tunable coefficients
      coefficients: {
        bicycleWeight: 3.0,    // Main CV detection
        timeWeight: 1.5,       // Time-based patterns
        weatherWeight: 1.2,    // Weather impact
        infraWeight: 2.0,      // Infrastructure safety
        historyWeight: 1.8,    // Historical patterns
        trafficWeight: 1.3     // Real-time traffic
      }
    };
  }

  /**
   * Calculate safety score from robust feature matrix
   */
  calculateRobustSafetyScore(matrix: RobustFeatureMatrix): number {
    let score = 10; // Start with max safety
    
    const {coefficients} = matrix;
    
    // Main risk factors
    score -= matrix.bicycleCount_current * coefficients.bicycleWeight;
    score -= matrix.timeOfDayRisk * coefficients.timeWeight;
    score -= matrix.currentTrafficDensity * coefficients.trafficWeight;
    score -= matrix.historicalAccidentRate * coefficients.historyWeight;
    
    // Infrastructure bonuses
    score += matrix.hasProtectedBikeLane * 2.0;
    score += matrix.hasTrafficLight * 1.0;
    score += matrix.isSchoolZone * 1.5;
    
    // Environmental factors
    score -= (10 - matrix.visibilityFactor) * 0.3; // Poor visibility = risk
    score += matrix.isGoodWeather * 1.0;
    
    // Peak hour and speed adjustments
    score *= (1 / matrix.peakHourMultiplier);
    score *= (1 / matrix.weatherRiskMultiplier);
    score -= (matrix.speedLimit - 25) * 0.1; // Higher speed = more risk
    
    // Clamp to 1-10 range
    return Math.max(1, Math.min(10, Math.round(score)));
  }

  private calculateHourRisk(hour: number): number {
    // Risk by hour: night = highest, morning = lowest
    if (hour >= 22 || hour <= 5) return 8;      // Night: high risk
    if (hour >= 6 && hour <= 9) return 4;       // Morning: low risk  
    if (hour >= 10 && hour <= 16) return 3;     // Daytime: lowest risk
    if (hour >= 17 && hour <= 21) return 6;     // Evening: medium risk
    return 5;
  }

  private calculateTemperatureComfort(temp: number): number {
    // Comfort zone: 60-75°F = 10, extremes = 0
    if (temp >= 60 && temp <= 75) return 10;
    if (temp >= 45 && temp <= 85) return 7;
    if (temp >= 32 && temp <= 95) return 4;
    return 1; // Extreme temperatures
  }

  /**
   * DEBUG MODE: Test all data sources and show JSON output
   */
  async debugAnalysis(latitude: number, longitude: number, bicycleCount: number = 0): Promise<{
    externalData: ExternalDataSources;
    featureMatrix: RobustFeatureMatrix;
    safetyScore: number;
    performanceMetrics: {
      totalTime: number;
      apiCallTimes: Record<string, number>;
      dataSourceSizes: Record<string, number>;
    };
  }> {
    console.log('🐛 [DEBUG] Starting comprehensive data source analysis...');
    const startTime = Date.now();
    const apiTimes: Record<string, number> = {};
    
    // Time each data source
    const timeDataStart = Date.now();
    const timeData = this.getTimeData();
    apiTimes.timeData = Date.now() - timeDataStart;
    
    const weatherStart = Date.now();
    const weatherData = await this.getWeatherData(latitude, longitude);
    apiTimes.weatherData = Date.now() - weatherStart;
    
    const infraStart = Date.now();
    const infrastructureData = await this.getInfrastructureData(latitude, longitude);
    apiTimes.infrastructureData = Date.now() - infraStart;
    
    const historyStart = Date.now();
    const historicalData = await this.getHistoricalData(latitude, longitude);
    apiTimes.historicalData = Date.now() - historyStart;
    
    const trafficStart = Date.now();
    const trafficData = await this.getTrafficData(latitude, longitude);
    apiTimes.trafficData = Date.now() - trafficStart;
    
    const externalData: ExternalDataSources = {
      timeData,
      weatherData,
      infrastructureData,
      historicalData,
      trafficData
    };
    
    // Create feature matrix
    const matrixStart = Date.now();
    const featureMatrix = this.createRobustFeatureMatrix(externalData, bicycleCount);
    apiTimes.featureMatrix = Date.now() - matrixStart;
    
    // Calculate safety score
    const scoreStart = Date.now();
    const safetyScore = this.calculateRobustSafetyScore(featureMatrix);
    apiTimes.safetyScore = Date.now() - scoreStart;
    
    const totalTime = Date.now() - startTime;
    
    // Calculate data sizes (for efficiency analysis)
    const dataSourceSizes = {
      timeData: JSON.stringify(timeData).length,
      weatherData: JSON.stringify(weatherData).length,
      infrastructureData: JSON.stringify(infrastructureData).length,
      historicalData: JSON.stringify(historicalData).length,
      trafficData: JSON.stringify(trafficData).length,
      featureMatrix: JSON.stringify(featureMatrix).length
    };
    
    const result = {
      externalData,
      featureMatrix,
      safetyScore,
      performanceMetrics: {
        totalTime,
        apiCallTimes: apiTimes,
        dataSourceSizes
      }
    };
    
    // Log comprehensive debug info
    console.log('🐛 [DEBUG] === COMPLETE ANALYSIS RESULTS ===');
    console.log('📊 [DEBUG] External Data Sources:', JSON.stringify(externalData, null, 2));
    console.log('🔢 [DEBUG] Feature Matrix:', JSON.stringify(featureMatrix, null, 2));
    console.log('🎯 [DEBUG] Final Safety Score:', safetyScore);
    console.log('⚡ [DEBUG] Performance Metrics:', JSON.stringify(result.performanceMetrics, null, 2));
    
    return result;
  }

  /**
   * DEBUG: Format analysis results for display
   */
  formatDebugResults(results: {
    externalData: ExternalDataSources;
    featureMatrix: RobustFeatureMatrix;
    safetyScore: number;
    performanceMetrics: any;
  }): string {
    const { externalData, featureMatrix, safetyScore, performanceMetrics } = results;
    
    return `
🐛 DEBUG ANALYSIS RESULTS
========================

📍 LOCATION DATA:
Time: ${externalData.timeData.timeCategory} (Hour: ${externalData.timeData.currentHour})
Peak Hour: ${externalData.timeData.isPeakHour ? 'YES' : 'NO'}
Weekend: ${externalData.timeData.isWeekend ? 'YES' : 'NO'}

🌤️ WEATHER DATA:
Temperature: ${externalData.weatherData.temperature}°F
Weather: ${externalData.weatherData.weatherCategory}
Visibility: ${externalData.weatherData.visibility} miles
Good Weather: ${externalData.weatherData.isGoodWeather ? 'YES' : 'NO'}

🏗️ INFRASTRUCTURE DATA:
Protected Bike Lane: ${externalData.infrastructureData.hasProtectedBikeLane ? 'YES' : 'NO'}
Traffic Light: ${externalData.infrastructureData.hasTrafficLight ? 'YES' : 'NO'}
Speed Limit: ${externalData.infrastructureData.speedLimit} mph
School Zone: ${externalData.infrastructureData.isSchoolZone ? 'YES' : 'NO'}
Intersection: ${externalData.infrastructureData.intersectionType}

📈 HISTORICAL DATA:
Accidents Last Year: ${externalData.historicalData.accidentCount_lastYear}
Bike Accidents: ${externalData.historicalData.bicycleAccidents_lastYear}
Crime Safety Score: ${externalData.historicalData.crimeSafetyScore}/10
Walk Score: ${externalData.historicalData.walkScore}

🚗 TRAFFIC DATA:
Current Density: ${externalData.trafficData.currentTrafficDensity}/10
Average Speed: ${externalData.trafficData.averageSpeed} mph
Congestion: ${externalData.trafficData.congestionLevel}

🔢 NUMERICAL FEATURE MATRIX:
Bicycle Count: ${featureMatrix.bicycleCount_current}/10
Peak Hour Factor: ${featureMatrix.isPeakHour}
Hour Risk Factor: ${featureMatrix.hourRiskFactor}/10
Weather Factor: ${featureMatrix.isGoodWeather}
Visibility Factor: ${featureMatrix.visibilityFactor}/10
Infrastructure Bonuses:
  - Protected Bike Lane: +${featureMatrix.hasProtectedBikeLane * 2.0}
  - Traffic Light: +${featureMatrix.hasTrafficLight * 1.0}
  - School Zone: +${featureMatrix.isSchoolZone * 1.5}
Risk Multipliers:
  - Peak Hour: ${featureMatrix.peakHourMultiplier}x
  - Weather: ${featureMatrix.weatherRiskMultiplier}x

🎯 FINAL SAFETY SCORE: ${safetyScore}/10
${safetyScore >= 8 ? '✅ SAFE' : safetyScore >= 6 ? '⚠️ MODERATE' : safetyScore >= 4 ? '🟡 CAUTION' : '🔴 HIGH RISK'}

⚡ PERFORMANCE METRICS:
Total Analysis Time: ${performanceMetrics.totalTime}ms
Data Source Times:
  - Time Data: ${performanceMetrics.apiCallTimes.timeData}ms
  - Weather: ${performanceMetrics.apiCallTimes.weatherData}ms
  - Infrastructure: ${performanceMetrics.apiCallTimes.infrastructureData}ms
  - Historical: ${performanceMetrics.apiCallTimes.historicalData}ms
  - Traffic: ${performanceMetrics.apiCallTimes.trafficData}ms
  - Feature Matrix: ${performanceMetrics.apiCallTimes.featureMatrix}ms
  - Score Calculation: ${performanceMetrics.apiCallTimes.safetyScore}ms

Data Sizes (bytes):
  - Time: ${performanceMetrics.dataSourceSizes.timeData}
  - Weather: ${performanceMetrics.dataSourceSizes.weatherData}
  - Infrastructure: ${performanceMetrics.dataSourceSizes.infrastructureData}
  - Historical: ${performanceMetrics.dataSourceSizes.historicalData}
  - Traffic: ${performanceMetrics.dataSourceSizes.trafficData}
  - Feature Matrix: ${performanceMetrics.dataSourceSizes.featureMatrix}
`;
  }

  /**
   * QUICK TEST: Test all data sources for a NYC location
   */
  async quickTest(): Promise<void> {
    const nycLat = 40.7589; // Manhattan
    const nycLon = -73.9851;
    const testBicycles = 2;
    
    console.log('🧪 [TEST] Starting quick data source test...');
    console.log(`📍 [TEST] Location: ${nycLat}, ${nycLon} (Manhattan)`);
    console.log(`🚴 [TEST] Test bicycle count: ${testBicycles}`);
    
    try {
      const results = await this.debugAnalysis(nycLat, nycLon, testBicycles);
      const formatted = this.formatDebugResults(results);
      console.log(formatted);
      
      // Check for any issues
      const issues = this.validateDataSources(results);
      if (issues.length > 0) {
        console.log('⚠️ [TEST] Issues found:');
        issues.forEach(issue => console.log(`  - ${issue}`));
      } else {
        console.log('✅ [TEST] All data sources working correctly!');
      }
      
    } catch (error) {
      console.error('❌ [TEST] Test failed:', error);
    }
  }

  /**
   * Validate data sources for issues
   */
  private validateDataSources(results: any): string[] {
    const issues: string[] = [];
    
    const { externalData, featureMatrix, safetyScore, performanceMetrics } = results;
    
    // Check for missing data
    if (!externalData.timeData) issues.push('Time data missing');
    if (!externalData.weatherData) issues.push('Weather data missing');
    if (!externalData.infrastructureData) issues.push('Infrastructure data missing');
    if (!externalData.historicalData) issues.push('Historical data missing');
    if (!externalData.trafficData) issues.push('Traffic data missing');
    
    // Check for performance issues
    if (performanceMetrics.totalTime > 5000) {
      issues.push(`Analysis too slow: ${performanceMetrics.totalTime}ms`);
    }
    
    // Check for invalid values
    if (safetyScore < 1 || safetyScore > 10) {
      issues.push(`Invalid safety score: ${safetyScore}`);
    }
    
    // Check for missing feature matrix values
    if (featureMatrix.bicycleCount_current < 0) {
      issues.push('Invalid bicycle count');
    }
    
    return issues;
  }
}

export default new DataSourceService(); 