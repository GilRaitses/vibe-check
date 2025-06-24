#!/usr/bin/env node

/**
 * Test script for Manhattan Camera Network Voronoi System
 * Tests the complete pipeline from camera generation to territory visualization
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_BASE = 'https://us-central1-vibe-check-463816.cloudfunctions.net/api';

console.log('🏗️ Testing Manhattan Camera Network Voronoi System\n');

// Test function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Test 1: Check API availability
async function testApiAvailability() {
  console.log('📡 Test 1: API Availability');
  
  try {
    const response = await makeRequest(`${API_BASE}/`);
    console.log(`✅ API Status: ${response.status}`);
    return true;
  } catch (error) {
    console.log(`❌ API Error: ${error.message}`);
    return false;
  }
}

// Test 2: Generate Camera Network
async function testNetworkGeneration() {
  console.log('\n🏗️ Test 2: Network Generation');
  
  try {
    const response = await makeRequest(`${API_BASE}/generate-camera-network`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ camera_count: 100 }) // Start with smaller count for testing
    });
    
    if (response.status === 200 && response.data.success) {
      console.log('✅ Network generation successful!');
      console.log(`📊 Generated: ${response.data.network_summary.total_cameras} cameras`);
      console.log(`🎯 Territories: ${response.data.network_summary.total_territories}`);
      console.log(`📏 Coverage: ${response.data.network_summary.coverage_area_km2} km²`);
      return true;
    } else {
      console.log(`❌ Network generation failed: ${response.status}`);
      console.log('Response:', response.data);
      return false;
    }
  } catch (error) {
    console.log(`❌ Network generation error: ${error.message}`);
    return false;
  }
}

// Test 3: Load Camera Network
async function testNetworkLoading() {
  console.log('\n📡 Test 3: Network Loading');
  
  try {
    const response = await makeRequest(`${API_BASE}/camera-network?include_territories=true&include_cameras=true`);
    
    if (response.status === 200 && response.data.success) {
      const territories = Object.keys(response.data.data.territories || {}).length;
      const cameras = Object.keys(response.data.data.cameras || {}).length;
      
      console.log('✅ Network loading successful!');
      console.log(`🎯 Loaded territories: ${territories}`);
      console.log(`📹 Loaded cameras: ${cameras}`);
      
      // Save sample territory for inspection
      const sampleTerritory = Object.values(response.data.data.territories || {})[0];
      if (sampleTerritory) {
        fs.writeFileSync(
          path.join(__dirname, 'sample-territory.json'),
          JSON.stringify(sampleTerritory, null, 2)
        );
        console.log('📄 Sample territory saved to sample-territory.json');
      }
      
      return true;
    } else {
      console.log(`❌ Network loading failed: ${response.status}`);
      console.log('Response:', response.data);
      return false;
    }
  } catch (error) {
    console.log(`❌ Network loading error: ${error.message}`);
    return false;
  }
}

// Test 4: Voronoi Map Data
async function testVoronoiMap() {
  console.log('\n🗺️ Test 4: Voronoi Map Data');
  
  try {
    const response = await makeRequest(`${API_BASE}/voronoi-map?include_analysis_stats=true`);
    
    if (response.status === 200 && response.data.success) {
      const territories = response.data.data.territories || [];
      console.log('✅ Voronoi map data successful!');
      console.log(`🎯 Map territories: ${territories.length}`);
      
      if (territories.length > 0) {
        const sampleTerritory = territories[0];
        console.log(`📊 Sample territory geometry vertices: ${sampleTerritory.geometry?.coordinates?.[0]?.length || 0}`);
        console.log(`⚠️ Sample risk score: ${sampleTerritory.properties?.risk_score?.toFixed(1) || 'N/A'}`);
        
        // Save Voronoi data for dashboard
        fs.writeFileSync(
          path.join(__dirname, 'voronoi-territories.json'),
          JSON.stringify(response.data, null, 2)
        );
        console.log('📄 Voronoi data saved to voronoi-territories.json');
      }
      
      return true;
    } else {
      console.log(`❌ Voronoi map failed: ${response.status}`);
      console.log('Response:', response.data);
      return false;
    }
  } catch (error) {
    console.log(`❌ Voronoi map error: ${error.message}`);
    return false;
  }
}

// Test 5: Generate Mock Data (fallback)
async function generateMockVoronoiData() {
  console.log('\n🎭 Test 5: Generating Mock Voronoi Data');
  
  try {
    // Generate mock Manhattan camera territories
    const mockTerritories = [];
    const manhattanBounds = {
      north: 40.8776,
      south: 40.7047,
      east: -73.9442,
      west: -74.0479
    };
    
    for (let i = 0; i < 50; i++) {
      // Generate random camera location within Manhattan
      const lat = manhattanBounds.south + Math.random() * (manhattanBounds.north - manhattanBounds.south);
      const lng = manhattanBounds.west + Math.random() * (manhattanBounds.east - manhattanBounds.west);
      
      // Generate octagonal territory around camera
      const vertices = [];
      const radius = 0.003; // ~300m in degrees
      
      for (let j = 0; j < 8; j++) {
        const angle = (j * Math.PI * 2) / 8;
        const vertexLat = lat + Math.cos(angle) * radius;
        const vertexLng = lng + Math.sin(angle) * radius;
        vertices.push([vertexLng, vertexLat]); // GeoJSON format: [lng, lat]
      }
      vertices.push(vertices[0]); // Close polygon
      
      const territory = {
        id: `territory_mock_${i.toString().padStart(3, '0')}`,
        camera_id: `cam_mock_${i.toString().padStart(3, '0')}`,
        geometry: {
          type: 'Polygon',
          coordinates: [vertices]
        },
        properties: {
          area_square_meters: Math.random() * 100000 + 50000,
          risk_score: Math.random() * 100,
          violation_density: Math.random() * 10,
          center: [lng, lat]
        },
        analysis_stats: {
          total_analyses: Math.floor(Math.random() * 1000),
          today_analyses: Math.floor(Math.random() * 50),
          last_analysis_ago: ['5m ago', '2h ago', '1d ago', 'Never'][Math.floor(Math.random() * 4)]
        }
      };
      
      mockTerritories.push(territory);
    }
    
    const mockData = {
      success: true,
      data: {
        territories: mockTerritories,
        map_metadata: {
          total_territories: mockTerritories.length,
          zoom_level: 12,
          bbox: 'full_manhattan',
          generated_at: new Date().toISOString()
        }
      }
    };
    
    // Save mock data
    fs.writeFileSync(
      path.join(__dirname, 'mock-voronoi-data.json'),
      JSON.stringify(mockData, null, 2)
    );
    
    console.log(`✅ Generated ${mockTerritories.length} mock territories`);
    console.log('📄 Mock data saved to mock-voronoi-data.json');
    
    return true;
  } catch (error) {
    console.log(`❌ Mock data generation error: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Manhattan Camera Network Tests...\n');
  
  const results = {
    apiAvailable: await testApiAvailability(),
    networkGeneration: false,
    networkLoading: false,
    voronoiMap: false,
    mockData: false
  };
  
  // Only proceed with generation if API is available
  if (results.apiAvailable) {
    results.networkGeneration = await testNetworkGeneration();
    
    // Wait a bit for network to be stored
    if (results.networkGeneration) {
      console.log('\n⏳ Waiting 3 seconds for network storage...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    results.networkLoading = await testNetworkLoading();
    results.voronoiMap = await testVoronoiMap();
  }
  
  // Always generate mock data as fallback
  results.mockData = await generateMockVoronoiData();
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log(`API Available: ${results.apiAvailable ? '✅' : '❌'}`);
  console.log(`Network Generation: ${results.networkGeneration ? '✅' : '❌'}`);
  console.log(`Network Loading: ${results.networkLoading ? '✅' : '❌'}`);
  console.log(`Voronoi Map: ${results.voronoiMap ? '✅' : '❌'}`);
  console.log(`Mock Data: ${results.mockData ? '✅' : '❌'}`);
  
  const successCount = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Overall Score: ${successCount}/${totalTests} (${Math.round(successCount/totalTests*100)}%)`);
  
  if (results.mockData) {
    console.log('\n🎭 You can use the mock data to test the dashboard:');
    console.log('   1. Open public/voronoi-dashboard.html');
    console.log('   2. Modify the API calls to use mock data from scripts/mock-voronoi-data.json');
  }
  
  if (results.voronoiMap) {
    console.log('\n🗽 Real Voronoi system is working! Dashboard should display Manhattan territories.');
  }
}

// Run the tests
runTests().catch(console.error); 