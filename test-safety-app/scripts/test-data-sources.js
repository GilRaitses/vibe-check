#!/usr/bin/env node

/**
 * Test Script for Data Source Service
 * Run with: node scripts/test-data-sources.js
 */

const fs = require('fs');
const path = require('path');

// Since we're using TypeScript, we need to compile or use ts-node
// For now, let's create a simple test that imports the service

console.log('🧪 NYC Safety App - Data Source Test');
console.log('=====================================\n');

// Test multiple NYC locations
const testLocations = [
  { name: 'Manhattan - Times Square', lat: 40.7589, lon: -73.9851 },
  { name: 'Brooklyn - Williamsburg', lat: 40.7081, lon: -73.9571 },
  { name: 'Queens - Long Island City', lat: 40.7505, lon: -73.9426 },
  { name: 'Bronx - Grand Concourse', lat: 40.8176, lon: -73.9482 }
];

console.log('Testing locations:');
testLocations.forEach((loc, i) => {
  console.log(`${i + 1}. ${loc.name} (${loc.lat}, ${loc.lon})`);
});
console.log('\n');

// Create a simple function to test
function testDataSources() {
  console.log('📋 To run the full data source test:');
  console.log('1. Start the Expo development server:');
  console.log('   npx expo start');
  console.log('');
  console.log('2. In the Metro console, type:');
  console.log('   import dataSourceService from \'./services/dataSourceService\';');
  console.log('   dataSourceService.quickTest();');
  console.log('');
  console.log('3. Or test with custom coordinates:');
  console.log('   dataSourceService.debugAnalysis(40.7589, -73.9851, 2);');
  console.log('');
  console.log('📊 This will show:');
  console.log('- Complete JSON output of all data sources');
  console.log('- Numerical feature matrix values');
  console.log('- Performance timing for each API call');
  console.log('- Data size analysis');
  console.log('- Safety score calculation breakdown');
  console.log('- Validation of all data sources');
}

testDataSources(); 