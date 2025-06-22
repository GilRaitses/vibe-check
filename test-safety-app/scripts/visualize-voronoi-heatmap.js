#!/usr/bin/env node

/**
 * VORONOI HEATMAP VISUALIZATION
 * Shows exactly how precomputed Voronoi territories are loaded and displayed as heatmap base
 */

const fs = require('fs');
const path = require('path');

// Load the precomputed territories
const territoriesPath = path.join(__dirname, '../assets/precomputed-territories.json');
const territoriesData = JSON.parse(fs.readFileSync(territoriesPath, 'utf8'));

console.log('🗺️ VORONOI TERRITORIES HEATMAP BASE STRUCTURE');
console.log('='.repeat(80));

const territories = territoriesData.manhattan_territories_precomputed.territories;
const territoryKeys = Object.keys(territories);

console.log(`📊 Total Territories: ${territoryKeys.length}`);
console.log(`📦 File Size: ${(fs.statSync(territoriesPath).size / 1024 / 1024).toFixed(2)} MB`);
console.log(`🗃️ Data Structure: GeoJSON-compatible Polygon format`);

// Analyze territory structure
const sampleTerritory = territories[territoryKeys[0]];
console.log('\n🔍 SAMPLE TERRITORY STRUCTURE:');
console.log('-'.repeat(50));
console.log(JSON.stringify(sampleTerritory, null, 2));

// Show how territories map to cameras
console.log('\n📍 CAMERA-TO-TERRITORY MAPPING:');
console.log('-'.repeat(50));

const territoryStats = territoryKeys.slice(0, 10).map(key => {
  const territory = territories[key];
  const coords = territory.geometry.coordinates[0];
  
  return {
    id: territory.id,
    cameraId: territory.cameraId,
    center: territory.center,
    vertices: coords.length,
    area: territory.area.toFixed(6),
    neighbors: territory.neighbors.length,
    bounds: {
      minLng: Math.min(...coords.map(c => c[0])).toFixed(6),
      maxLng: Math.max(...coords.map(c => c[0])).toFixed(6),
      minLat: Math.min(...coords.map(c => c[1])).toFixed(6),
      maxLat: Math.max(...coords.map(c => c[1])).toFixed(6)
    }
  };
});

console.table(territoryStats);

// Show how territories become heatmap polygons
console.log('\n🎨 HEATMAP POLYGON CONVERSION:');
console.log('-'.repeat(50));

function convertToHeatMapPolygon(territory, riskScore = 5, analysisState = 'unanalyzed') {
  const coords = territory.geometry.coordinates[0];
  
  // Convert GeoJSON coordinates to React Native Maps format
  const coordinates = coords.map(coord => ({
    latitude: coord[1],  // GeoJSON uses [lng, lat]
    longitude: coord[0]
  }));
  
  // Determine color based on risk score
  let color = '#808080'; // Default gray
  if (analysisState === 'completed') {
    if (riskScore >= 8) color = '#34C759'; // Green - Safe
    else if (riskScore >= 6) color = '#FFCC00'; // Yellow - Moderate  
    else if (riskScore >= 4) color = '#FF9500'; // Orange - Caution
    else color = '#FF3B30'; // Red - High Risk
  } else if (analysisState === 'analyzing') {
    color = '#FFB6C1'; // Sakura pink for processing
  } else if (analysisState === 'queued') {
    color = '#FFB6C1'; // Sakura pink for queued
  }
  
  return {
    id: territory.id,
    coordinates,
    riskScore,
    color,
    opacity: analysisState === 'completed' ? 0.4 : 0.2,
    analysisState,
    strokeColor: color,
    strokeWidth: 1
  };
}

// Example conversions
const exampleTerritories = territoryKeys.slice(0, 5).map(key => {
  const territory = territories[key];
  const riskScore = Math.floor(Math.random() * 10) + 1;
  const states = ['unanalyzed', 'queued', 'analyzing', 'completed', 'error'];
  const analysisState = states[Math.floor(Math.random() * states.length)];
  
  return convertToHeatMapPolygon(territory, riskScore, analysisState);
});

console.log('🔄 Example Territory → HeatMap Polygon Conversion:');
exampleTerritories.forEach((polygon, index) => {
  console.log(`\n${index + 1}. ${polygon.id}:`);
  console.log(`   Risk Score: ${polygon.riskScore}/10`);
  console.log(`   Color: ${polygon.color}`);
  console.log(`   State: ${polygon.analysisState}`);
  console.log(`   Vertices: ${polygon.coordinates.length}`);
  console.log(`   Bounds: ${polygon.coordinates[0].latitude.toFixed(4)}, ${polygon.coordinates[0].longitude.toFixed(4)} → ${polygon.coordinates[2].latitude.toFixed(4)}, ${polygon.coordinates[2].longitude.toFixed(4)}`);
});

// Show AsyncStorage loading simulation
console.log('\n💾 ASYNCSTORAGE LOADING SIMULATION:');
console.log('-'.repeat(50));

function simulateAsyncStorageLoad() {
  console.log('🔮 [VORONOI_LOADER] Starting precomputed Voronoi territories loading...');
  console.log(`📊 [VORONOI_LOADER] Precomputed data keys found: ${territoryKeys.length}`);
  
  let territoriesLoaded = 0;
  const totalSize = JSON.stringify(territoriesData).length;
  
  console.log(`📦 [VORONOI_LOADER] Loading ${territoryKeys.length} territories (${(totalSize / 1024 / 1024).toFixed(2)} MB)...`);
  
  // Simulate loading chunks
  const chunkSize = 50;
  for (let i = 0; i < territoryKeys.length; i += chunkSize) {
    const chunk = territoryKeys.slice(i, i + chunkSize);
    territoriesLoaded += chunk.length;
    const progress = ((territoriesLoaded / territoryKeys.length) * 100).toFixed(1);
    console.log(`📍 [VORONOI_LOADER] Loaded ${territoriesLoaded}/${territoryKeys.length} territories (${progress}%)`);
  }
  
  console.log('✅ [VORONOI_LOADER] All territories loaded successfully');
  console.log(`🔍 [VORONOI_LOADER] Sample territory verification:`);
  
  const sample = territories[territoryKeys[0]];
  console.log(`   ID: ${sample.id}`);
  console.log(`   Camera: ${sample.cameraId}`);
  console.log(`   Vertices: ${sample.geometry.coordinates[0].length}`);
  console.log(`   Area: ${sample.area.toFixed(6)} sq units`);
  console.log(`   Neighbors: ${sample.neighbors.length}`);
  console.log(`   Center: [${sample.center[1].toFixed(4)}, ${sample.center[0].toFixed(4)}]`);
}

simulateAsyncStorageLoad();

// Show heat map rendering process
console.log('\n🎨 HEAT MAP RENDERING PROCESS:');
console.log('-'.repeat(50));

console.log('1. 📱 App Startup → Load territories from AsyncStorage');
console.log('2. 📍 User Location → Filter territories within 2km radius');
console.log('3. 🗺️ Territory Loading → Convert GeoJSON to React Native Maps format');
console.log('4. 🎯 Analysis State → Apply colors based on risk scores and processing state');
console.log('5. 🎨 Polygon Rendering → Display Voronoi cells as heat map base');
console.log('6. 🔄 Real-time Updates → Update colors as analysis completes');

// Show territory filtering by proximity
console.log('\n📍 PROXIMITY FILTERING EXAMPLE:');
console.log('-'.repeat(50));

const userLocation = { latitude: 40.7589, longitude: -73.9851 }; // Times Square
console.log(`👤 User Location: ${userLocation.latitude}, ${userLocation.longitude} (Times Square)`);

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const nearbyTerritories = territoryKeys.filter(key => {
  const territory = territories[key];
  const distance = calculateDistance(
    userLocation.latitude, userLocation.longitude,
    territory.center[1], territory.center[0]
  );
  return distance <= 2; // Within 2km
}).slice(0, 10);

console.log(`🎯 Nearby Territories (within 2km): ${nearbyTerritories.length}/${territoryKeys.length}`);
nearbyTerritories.forEach((key, index) => {
  const territory = territories[key];
  const distance = calculateDistance(
    userLocation.latitude, userLocation.longitude,
    territory.center[1], territory.center[0]
  );
  console.log(`   ${index + 1}. ${territory.id} - ${distance.toFixed(2)}km away`);
});

console.log('\n🏗️ HEAT MAP ARCHITECTURE SUMMARY:');
console.log('='.repeat(80));
console.log('✅ Precomputed Voronoi territories: 465KB JSON file');
console.log('✅ GeoJSON-compatible polygon format');
console.log('✅ AsyncStorage persistent loading');
console.log('✅ Proximity-based filtering (2km radius)');
console.log('✅ Real-time color updates based on analysis state');
console.log('✅ Camera metadata integration');
console.log('✅ Neighbor relationship mapping');
console.log('✅ Performance optimized (no real-time Voronoi generation)');

console.log('\n🎯 READY FOR HEATMAP RENDERING!');
console.log('The app will load these Voronoi polygons as the base layer for the heat map,');
console.log('with colors dynamically updated based on camera analysis results.'); 