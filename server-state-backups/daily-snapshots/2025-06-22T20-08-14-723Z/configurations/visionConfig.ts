// Vision Analysis Configuration
// Optimized for minimal compute footprint and maximum information density

export interface VisionVariable {
  id: string;
  positions: string[];
  encoding: Record<string, number>;
}

export interface VisionConfig {
  variables: VisionVariable[];
  prompt: string;
  responseFormat: string;
}

// Encoded categories for computational efficiency
export const VISION_VARIABLES: VisionVariable[] = [
  {
    id: 'bikes',
    positions: ['sidewalk', 'street', 'bike_lane', 'crosswalk', 'parked'],
    encoding: {
      'none': 0,
      'few': 1,
      'some': 2,
      'many': 3,
      'crowded': 4
    }
  },
  {
    id: 'people',
    positions: ['sidewalk', 'street', 'crosswalk', 'waiting', 'moving'],
    encoding: {
      'none': 0,
      'few': 1,
      'some': 2,
      'many': 3,
      'crowded': 4
    }
  },
  {
    id: 'vehicles',
    positions: ['moving', 'stopped', 'parked', 'turning', 'blocking'],
    encoding: {
      'none': 0,
      'light': 1,
      'moderate': 2,
      'heavy': 3,
      'jammed': 4
    }
  },
  {
    id: 'activity',
    positions: ['pedestrian', 'cycling', 'traffic', 'construction', 'emergency'],
    encoding: {
      'none': 0,
      'low': 1,
      'moderate': 2,
      'high': 3,
      'intense': 4
    }
  },
  {
    id: 'infrastructure',
    positions: ['signals', 'signs', 'lanes', 'barriers', 'lighting'],
    encoding: {
      'none': 0,
      'minimal': 1,
      'basic': 2,
      'good': 3,
      'excellent': 4
    }
  }
];

// Optimized prompt for minimal API compute
export const VISION_CONFIG: VisionConfig = {
  variables: VISION_VARIABLES,
  prompt: `Analyze this traffic camera image and return ONLY a numerical array with exactly 25 numbers (0-4) in this exact order:

[bikes_sidewalk, bikes_street, bikes_bike_lane, bikes_crosswalk, bikes_parked, people_sidewalk, people_street, people_crosswalk, people_waiting, people_moving, vehicles_moving, vehicles_stopped, vehicles_parked, vehicles_turning, vehicles_blocking, activity_pedestrian, activity_cycling, activity_traffic, activity_construction, activity_emergency, infrastructure_signals, infrastructure_signs, infrastructure_lanes, infrastructure_barriers, infrastructure_lighting]

Count what you see and rate: 0=none, 1=few, 2=some, 3=many, 4=crowded

Return ONLY the array like: [2,0,1,3,2,1,0,2,3,1,2,0,1,2,3,0,1,2,1,3,2,0,1,2,3]`,
  
  responseFormat: 'text'
};

// Type for the raw vision API response
export interface RawVisionResponse {
  // Bikes
  bikes_sidewalk: number;
  bikes_street: number;
  bikes_bike_lane: number;
  bikes_crosswalk: number;
  bikes_parked: number;
  
  // People
  people_sidewalk: number;
  people_street: number;
  people_crosswalk: number;
  people_waiting: number;
  people_moving: number;
  
  // Vehicles
  vehicles_moving: number;
  vehicles_stopped: number;
  vehicles_parked: number;
  vehicles_turning: number;
  vehicles_blocking: number;
  
  // Activity
  activity_pedestrian: number;
  activity_cycling: number;
  activity_traffic: number;
  activity_construction: number;
  activity_emergency: number;
  
  // Infrastructure
  infrastructure_signals: number;
  infrastructure_signs: number;
  infrastructure_lanes: number;
  infrastructure_barriers: number;
  infrastructure_lighting: number;
}

// Helper to generate all possible keys
export function generateVisionKeys(): string[] {
  const keys: string[] = [];
  for (const variable of VISION_VARIABLES) {
    for (const position of variable.positions) {
      keys.push(`${variable.id}_${position}`);
    }
  }
  return keys;
}

// Validation function
export function validateVisionResponse(response: any): response is RawVisionResponse {
  const requiredKeys = generateVisionKeys();
  
  for (const key of requiredKeys) {
    if (!(key in response)) return false;
    if (typeof response[key] !== 'number') return false;
    if (response[key] < 0 || response[key] > 4) return false;
  }
  
  return true;
} 