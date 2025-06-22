/**
 * Sidewalk Violation Detection Config
 * Specialized feature matrix for user-uploaded photos of bikes on sidewalks
 * Used for 311 reporting and block score updates
 */

export interface SidewalkViolationMatrix {
  // Cyclist behavior (0-4 scale)
  cyclist_speed: number;           // 0=stationary, 4=fast moving
  cyclist_direction: number;       // 0=stopped, 4=against pedestrian flow
  cyclist_awareness: number;       // 0=careful/aware, 4=oblivious/aggressive
  cyclist_equipment: number;       // 0=walking bike, 4=racing/delivery setup
  
  // Pedestrian impact (0-4 scale)
  pedestrian_density: number;     // 0=empty sidewalk, 4=crowded
  pedestrian_reaction: number;    // 0=no impact, 4=people jumping aside
  pedestrian_vulnerable: number;  // 0=none, 4=elderly/children/disabled present
  
  // Infrastructure context (0-4 scale)
  sidewalk_width: number;         // 0=very wide, 4=narrow
  bike_lane_proximity: number;    // 0=bike lane right there, 4=no bike infrastructure
  pedestrian_infrastructure: number; // 0=good (benches, trees), 4=poor
  
  // Violation severity (0-4 scale)
  safety_risk: number;            // 0=minimal risk, 4=dangerous situation
  violation_clarity: number;      // 0=ambiguous, 4=clear sidewalk cycling
  repeat_location: number;        // 0=first report, 4=known problem spot
}

export const SIDEWALK_VIOLATION_VARIABLES = [
  'cyclist_speed',
  'cyclist_direction', 
  'cyclist_awareness',
  'cyclist_equipment',
  'pedestrian_density',
  'pedestrian_reaction',
  'pedestrian_vulnerable',
  'sidewalk_width',
  'bike_lane_proximity',
  'pedestrian_infrastructure',
  'safety_risk',
  'violation_clarity',
  'repeat_location'
] as const;

export const SIDEWALK_VIOLATION_PROMPT = `
Analyze this image for a cyclist on a sidewalk violation. Return exactly 13 numbers (0-4 scale) separated by commas, no other text.

Variables to encode:
1. cyclist_speed: How fast is the cyclist moving? (0=stationary/walking bike, 4=fast cycling)
2. cyclist_direction: Cyclist direction vs pedestrian flow (0=stopped, 4=against flow)
3. cyclist_awareness: Cyclist awareness of pedestrians (0=careful/yielding, 4=oblivious/aggressive)
4. cyclist_equipment: Type of cycling setup (0=casual/walking, 4=racing/delivery)
5. pedestrian_density: How crowded is the sidewalk? (0=empty, 4=very crowded)
6. pedestrian_reaction: Pedestrian response to cyclist (0=no reaction, 4=jumping aside)
7. pedestrian_vulnerable: Vulnerable people present? (0=none, 4=elderly/children/disabled)
8. sidewalk_width: Width of sidewalk (0=very wide, 4=narrow)
9. bike_lane_proximity: How close is proper bike infrastructure? (0=right there, 4=blocks away)
10. pedestrian_infrastructure: Quality of pedestrian space (0=good amenities, 4=poor)
11. safety_risk: Overall safety risk level (0=minimal, 4=dangerous)
12. violation_clarity: How clear is the violation? (0=ambiguous, 4=obvious sidewalk cycling)
13. repeat_location: Known problem area? (0=first report, 4=frequent violations)

Example response: 3,2,4,2,3,2,1,2,3,1,4,4,2
`;

export function parseSidewalkViolationResponse(response: string): SidewalkViolationMatrix {
  const numbers = response.trim().split(',').map(n => parseInt(n.trim()));
  
  if (numbers.length !== 13 || numbers.some(n => isNaN(n) || n < 0 || n > 4)) {
    throw new Error('Invalid sidewalk violation response format');
  }
  
  return {
    cyclist_speed: numbers[0],
    cyclist_direction: numbers[1],
    cyclist_awareness: numbers[2],
    cyclist_equipment: numbers[3],
    pedestrian_density: numbers[4],
    pedestrian_reaction: numbers[5],
    pedestrian_vulnerable: numbers[6],
    sidewalk_width: numbers[7],
    bike_lane_proximity: numbers[8],
    pedestrian_infrastructure: numbers[9],
    safety_risk: numbers[10],
    violation_clarity: numbers[11],
    repeat_location: numbers[12]
  };
}

export function calculateViolationScore(matrix: SidewalkViolationMatrix): number {
  // Higher score = more serious violation
  const baseScore = (
    matrix.cyclist_speed * 1.5 +
    matrix.cyclist_awareness * 2.0 +
    matrix.safety_risk * 2.5
  );
  
  const contextMultiplier = (
    matrix.pedestrian_density * 0.5 +
    matrix.pedestrian_vulnerable * 1.5 +
    matrix.violation_clarity * 1.0
  ) / 10;
  
  return Math.min(10, baseScore * (1 + contextMultiplier));
}

export function generate311Report(matrix: SidewalkViolationMatrix, location: string, timestamp: Date): string {
  const score = calculateViolationScore(matrix);
  const severity = score > 7 ? 'HIGH' : score > 4 ? 'MEDIUM' : 'LOW';
  
  return `
SIDEWALK CYCLING VIOLATION REPORT
Location: ${location}
Date/Time: ${timestamp.toLocaleString()}
Severity: ${severity} (Score: ${score.toFixed(1)}/10)

INCIDENT DETAILS:
- Cyclist Speed: ${['Stationary', 'Slow', 'Moderate', 'Fast', 'Very Fast'][matrix.cyclist_speed]}
- Cyclist Behavior: ${['Careful', 'Cautious', 'Neutral', 'Careless', 'Aggressive'][matrix.cyclist_awareness]}
- Pedestrian Impact: ${['None', 'Minimal', 'Moderate', 'Significant', 'Severe'][matrix.pedestrian_reaction]}
- Safety Risk: ${['Minimal', 'Low', 'Moderate', 'High', 'Dangerous'][matrix.safety_risk]}

CONTEXT:
- Sidewalk Conditions: ${matrix.sidewalk_width < 2 ? 'Wide' : 'Narrow'}
- Pedestrian Density: ${['Empty', 'Light', 'Moderate', 'Busy', 'Crowded'][matrix.pedestrian_density]}
- Vulnerable People Present: ${matrix.pedestrian_vulnerable > 2 ? 'Yes' : 'No'}
- Bike Infrastructure Nearby: ${matrix.bike_lane_proximity < 2 ? 'Available' : 'Not Available'}

RECOMMENDATION: ${severity === 'HIGH' ? 'Immediate enforcement needed' : 
                 severity === 'MEDIUM' ? 'Regular patrol recommended' : 
                 'Monitor for patterns'}
  `.trim();
} 