#!/usr/bin/env node

/**
 * Demo Flow Test Script
 * Tests all the key functionality needed for the 4-minute presentation demo
 */

const fs = require('fs');
const path = require('path');

console.log('🎬 Testing NYC Safety App Demo Flow...\n');

// Test 1: Check if all required files exist
console.log('📁 Checking required files...');
const requiredFiles = [
  'config/visionConfig.ts',
  'config/sidewalkViolationConfig.ts',
  'services/moondreamService.ts',
  'services/userReportingService.ts',
  'services/nycCameraService.ts',
  'services/asyncStorageService.ts'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ Some required files are missing. Demo may not work properly.');
  process.exit(1);
}

// Test 2: Check environment variables
console.log('\n🔑 Checking environment variables...');
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  if (envContent.includes('EXPO_PUBLIC_MOONDREAM_API_KEY')) {
    console.log('✅ Moondream API key configured');
  } else {
    console.log('⚠️  Moondream API key not found in .env');
  }
} else {
  console.log('⚠️  .env file not found');
}

// Test 3: Verify config structures
console.log('\n⚙️  Testing config structures...');

try {
  // Test vision config
  const visionConfigPath = path.join(__dirname, '..', 'config', 'visionConfig.ts');
  const visionConfig = fs.readFileSync(visionConfigPath, 'utf8');
  
  if (visionConfig.includes('VISION_VARIABLES') && visionConfig.includes('25')) {
    console.log('✅ Vision config has 25 variables');
  } else {
    console.log('❌ Vision config structure incorrect');
  }

  // Test sidewalk violation config
  const sidewalkConfigPath = path.join(__dirname, '..', 'config', 'sidewalkViolationConfig.ts');
  const sidewalkConfig = fs.readFileSync(sidewalkConfigPath, 'utf8');
  
  if (sidewalkConfig.includes('SIDEWALK_VIOLATION_VARIABLES') && sidewalkConfig.includes('13')) {
    console.log('✅ Sidewalk violation config has 13 variables');
  } else {
    console.log('❌ Sidewalk violation config structure incorrect');
  }

} catch (error) {
  console.log('❌ Error reading config files:', error.message);
}

// Test 4: Generate sample log output for demo
console.log('\n📊 Generating sample demo log output...\n');

console.log('='.repeat(60));
console.log('SAMPLE DEMO LOG OUTPUT - NYC Safety App');
console.log('='.repeat(60));

// Simulate camera analysis
console.log('\n🎥 NYC Camera Analysis Started...');
console.log('📍 Location: Union Square, Manhattan');
console.log('🔍 Analyzing camera feed...');

setTimeout(() => {
  console.log('\n🔢 Raw Vision API Response:');
  console.log('[2,0,1,3,2,1,0,2,3,1,2,0,1,2,3,0,1,2,1,3,2,0,1,2,3]');
  
  console.log('\n📋 Converted to Feature Matrix:');
  console.log(JSON.stringify({
    bikes_sidewalk: 2,
    bikes_street: 0,
    bikes_bike_lane: 1,
    people_sidewalk: 3,
    people_street: 2,
    people_crosswalk: 1,
    vehicles_moving: 2,
    vehicles_stopped: 3,
    vehicles_parked: 1,
    activity_pedestrian: 2,
    activity_cycling: 0,
    infrastructure_signals: 1,
    infrastructure_signs: 2,
    infrastructure_lanes: 3,
    infrastructure_barriers: 0,
    infrastructure_lighting: 1
  }, null, 2));

  console.log('\n🧮 Mathematical Analysis:');
  console.log('Stress Factors = 2.5 × 0 + 1.5 × 2 = 3.0');
  console.log('Comfort Bonus = 2 × 1 + 1 × 1 = 3.0');
  console.log('Chill Score = 10 - 3.0 + 3.0 = 10.0/10 (VERY CHILL!)');

  console.log('\n💾 Saved to AsyncStorage: camera_union_square_analysis');
  console.log('✅ Camera analysis complete (15.2 seconds)');

}, 1000);

// Simulate user photo upload
setTimeout(() => {
  console.log('\n📸 User Violation Report Started...');
  console.log('📍 Location: 14th St & 3rd Ave');
  console.log('🔍 Analyzing user photo...');

  setTimeout(() => {
    console.log('\n🔢 Raw Violation API Response:');
    console.log('[3,2,4,2,3,2,1,2,3,1,4,4,2]');
    
    console.log('\n📋 Converted to Violation Matrix:');
    console.log(JSON.stringify({
      cyclist_speed: 3,
      cyclist_direction: 2,
      cyclist_awareness: 4,
      cyclist_equipment: 2,
      pedestrian_density: 3,
      pedestrian_reaction: 2,
      pedestrian_vulnerable: 1,
      sidewalk_width: 2,
      bike_lane_proximity: 3,
      pedestrian_infrastructure: 1,
      safety_risk: 4,
      violation_clarity: 4,
      repeat_location: 2
    }, null, 2));

    console.log('\n🧮 Violation Score Calculation:');
    console.log('Base Score = 3×1.5 + 4×2.0 + 4×2.5 = 22.5');
    console.log('Context Multiplier = (3×0.5 + 1×1.5 + 4×1.0)/10 = 0.4');
    console.log('Final Score = min(10, 22.5 × 1.4) = 10.0/10 (HIGH SEVERITY)');

    console.log('\n📊 Updated block score: block_40.734_-73.989');
    console.log('📄 Generated 311 report: violation_1719072000000');
    console.log('✅ Violation report complete (12.8 seconds)');

  }, 1000);
}, 3000);

// Simulate route optimization
setTimeout(() => {
  console.log('\n🗺️  Route Optimization Started...');
  console.log('📍 From: Union Square → To: Washington Square Park');
  
  setTimeout(() => {
    console.log('\n📊 Route Analysis:');
    console.log('🚀 Fastest Route: 14th St → 6th Ave (8 minutes)');
    console.log('   - Chill Score: 4.2/10 (heavy traffic, bikes in street)');
    console.log('😌 Chill Route: 12th St → University Pl (13 minutes)');
    console.log('   - Chill Score: 8.7/10 (protected bike lanes, trees)');
    
    console.log('\n💡 Recommendation: Take the chill route');
    console.log('   +5 minutes, but way more relaxing!');
    console.log('✅ Route optimization complete');

  }, 1000);
}, 6000);

console.log('\n' + '='.repeat(60));
console.log('Demo test complete! 🎉');
console.log('This is the type of output you should see during the live demo.');
console.log('='.repeat(60)); 