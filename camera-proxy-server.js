const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const PORT = 3001;
const imageCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

// Load tessellation data and Firebase configuration
let tessellationZones = [];
let camerasData = [];
let zoneLookup = {};
const FIREBASE_FUNCTIONS_URL = 'https://us-central1-vibe-check-463816.cloudfunctions.net/api';

console.log('🚀 Starting enhanced camera proxy server with zone analytics...');

// Load data on startup
async function loadTessellationData() {
  try {
    const zonesData = JSON.parse(fs.readFileSync('data/complete_voronoi_zones.json', 'utf8'));
    tessellationZones = Array.isArray(zonesData) ? zonesData : (zonesData.zones || []);
    
    const cameras = JSON.parse(fs.readFileSync('data/cameras-with-handles.json', 'utf8'));
    camerasData = cameras || [];
    
    console.log(`✅ Loaded ${tessellationZones.length} zones and ${camerasData.length} cameras`);
  } catch (error) {
    console.error('❌ Error loading tessellation data:', error.message);
  }
}

// Load zone lookup table for quick access
try {
  zoneLookup = JSON.parse(fs.readFileSync('data/zone-lookup.json', 'utf8'));
  console.log(`✅ Loaded ${Object.keys(zoneLookup).length} zone lookups`);
} catch (error) {
  console.error('⚠️ Could not load zone lookup table:', error.message);
}

// Calculate sampling frequency based on camera priority
function calculateSamplingFrequency(camera) {
  if (!camera || !camera.name) return 12;
  
  const name = camera.name.toLowerCase();
  if (name.includes('hell') || name.includes('times square')) return 0.5; // 30 min
  if (name.includes('broadway') || name.includes('8th ave')) return 1; // 1 hour  
  if (name.includes('ave') || name.includes('st')) return 4; // 4 hours
  return 12; // 12 hours default
}

// Function to fetch real ML analytics from Firebase
async function fetchRealMLAnalytics(cameraId) {
  try {
    // Fix: Updated to match Firebase Functions endpoint (/get-metrics/:location)
    const response = await fetch(`${FIREBASE_FUNCTIONS_URL}/get-metrics/${cameraId}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      timeout: 5000  // 5 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Real ML data for camera ${cameraId}`);
      return {
        analytics_available: true,
        data_source: 'firebase_ml',
        firebase_status: 'connected',
        ml_metrics: {
          violation_rates: data.violation_rates || {
            bike_red_light_violations: data.bike_violations || 0,
            pedestrian_walkway_violations: data.pedestrian_violations || 0,
            dangerous_positioning_violations: data.positioning_violations || 0
          },
          metrics_count: data.total_violations || 0,
          last_updated: data.last_updated || new Date().toISOString(),
          confidence_score: data.confidence_score || 85
        }
      };
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.log(`⚠️ Firebase connection failed for camera ${cameraId}: ${error.message}`);
    
    // Fallback to enhanced simulated data with real zone info
    const zoneInfo = zoneLookup[cameraId];
    return {
      analytics_available: Math.random() > 0.7, // 30% success rate for development
      data_source: 'simulated_enhanced',
      firebase_status: 'fallback',
      zone_id: zoneInfo?.zone_id || `UN_${String(cameraId).padStart(3, '0')}`,
      borough: zoneInfo?.borough || 'UN',
      camera_name: zoneInfo?.camera_name || `Camera ${cameraId}`,
      ml_metrics: {
        violation_rates: {
          bike_red_light_violations: Math.floor(Math.random() * 5),
          pedestrian_walkway_violations: Math.floor(Math.random() * 3),
          dangerous_positioning_violations: Math.floor(Math.random() * 2)
        },
        metrics_count: Math.floor(Math.random() * 10) + 1,
        last_updated: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        confidence_score: 60 + Math.floor(Math.random() * 30) // 60-90%
      }
    };
  }
}

// Enhanced function to get camera zone analytics using zone lookup
async function getCameraZoneAnalytics(cameraId) {
  const zoneInfo = zoneLookup[cameraId];
  const mlAnalytics = await fetchRealMLAnalytics(cameraId);
  
  return {
    camera_id: cameraId,
    zone_id: zoneInfo?.zone_id || `UN_${String(cameraId).padStart(3, '0')}`,
    borough: zoneInfo?.borough || 'UN',
    camera_name: zoneInfo?.camera_name || `Camera ${cameraId}`,
    camera_handle: zoneInfo?.camera_handle || zoneInfo?.old_handle || '',
    coordinates: zoneInfo?.coordinates || [-73.9851, 40.7589],
    ...mlAnalytics,
    // Add zone-specific metadata
    zone_metadata: {
      handle: zoneInfo?.handle,
      old_handle: zoneInfo?.old_handle,
      camera_handle: zoneInfo?.camera_handle
    }
  };
}

function fetchCameraImage(cameraId) {
  return new Promise((resolve, reject) => {
    const tmcUrl = `https://webcams.nyctmc.org/api/cameras/${cameraId}/image`;
    
    https.get(tmcUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NYC-Camera-Proxy/1.0)'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const imageBuffer = Buffer.concat(chunks);
        resolve(imageBuffer);
      });
    }).on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Zone Analytics API
  if (pathname === '/api/zones') {
    // Get first 50 zones from zone lookup table
    const zoneEntries = Object.entries(zoneLookup).slice(0, 50);
    const zones = await Promise.all(
      zoneEntries.map(async ([cameraId, zoneInfo]) => {
        const analytics = await getCameraZoneAnalytics(parseInt(cameraId));
        const samplingFreq = calculateSamplingFrequency(null); // Use default calculation
        
        return {
          zone_id: zoneInfo.zone_id,
          camera_id: parseInt(cameraId),
          camera_name: zoneInfo.camera_name,
          borough: zoneInfo.borough,
          coordinates: zoneInfo.coordinates,
          zone_geometry: null, // Would need to load from tessellation data
          sampling_frequency: samplingFreq,
          priority_level: samplingFreq < 2 ? 'critical' : 'normal',
          data_source: analytics.data_source,
          analytics_available: analytics.analytics_available
        };
      })
    );

    const boroughCounts = {};
    Object.values(zoneLookup).forEach(zone => {
      boroughCounts[zone.borough] = (boroughCounts[zone.borough] || 0) + 1;
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      total: Object.keys(zoneLookup).length,
      zones: zones,
      firebase_connection: zones.some(z => z.data_source === 'firebase_ml') ? 'active' : 'fallback',
      borough_distribution: boroughCounts,
      zone_id_format: 'BB_###',
      metadata: {
        description: 'Borough (2 char) + underscore + camera number (3 char)',
        last_updated: new Date().toISOString()
      }
    }));
    return;
  }
  
  // Individual zone analytics
  if (pathname.startsWith('/api/zone-analytics/')) {
    const cameraId = parseInt(pathname.split('/api/zone-analytics/')[1]);
    const analytics = await getCameraZoneAnalytics(cameraId);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(analytics || { error: 'Zone not found' }));
    return;
  }
  
  // Dev Dashboard
  if (pathname === '/dev-dashboard') {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Vibe-Check Zone Analytics</title>
  <meta charset="utf-8">
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #1a1a1a; color: white; }
    .header { background: #2d3748; padding: 15px; }
    .container { display: flex; height: calc(100vh - 80px); }
    .sidebar { width: 300px; background: #2d3748; padding: 20px; overflow-y: auto; }
    .map-container { flex: 1; }
    #map { width: 100%; height: 100%; }
    .zone-card { background: #4a5568; padding: 10px; margin: 10px 0; border-radius: 5px; cursor: pointer; }
    .zone-card:hover { background: #718096; }
    .critical { border-left: 4px solid #e53e3e; }
    .normal { border-left: 4px solid #38a169; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🗽 Vibe-Check Zone Analytics</h1>
    <span id="status">Loading...</span>
  </div>
  
  <div class="container">
    <div class="sidebar">
      <div id="zone-list"></div>
    </div>
    <div class="map-container">
      <div id="map"></div>
    </div>
  </div>

  <script>
    let map = L.map('map').setView([40.7589, -73.9851], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    fetch('/api/zones')
      .then(r => r.json())
      .then(data => {
        document.getElementById('status').textContent = data.total + ' zones loaded';
        
        const list = document.getElementById('zone-list');
        data.zones.forEach(zone => {
          const card = document.createElement('div');
          card.className = 'zone-card ' + zone.priority_level;
          card.innerHTML = '<strong>' + zone.camera_name + '</strong><br>' +
                          'Frequency: ' + zone.sampling_frequency + 'h<br>' +
                          'Analytics: ' + (zone.analytics_available ? '✅' : '⏳');
          card.onclick = () => {
            map.setView([zone.coordinates[1], zone.coordinates[0]], 15);
            L.popup()
              .setLatLng([zone.coordinates[1], zone.coordinates[0]])
              .setContent('<b>' + zone.camera_name + '</b><br>Zone: ' + zone.zone_id)
              .openOn(map);
          };
          list.appendChild(card);
          
          // Add marker
          L.marker([zone.coordinates[1], zone.coordinates[0]])
            .bindPopup('<b>' + zone.camera_name + '</b>')
            .addTo(map);
        });
      })
      .catch(e => {
        document.getElementById('status').textContent = 'Error loading zones';
        console.error(e);
      });
  </script>
</body>
</html>`;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }
  
  // Camera image proxy
  if (pathname.startsWith('/api/camera-image/')) {
    const cameraId = pathname.split('/api/camera-image/')[1];
    
    if (!cameraId) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing camera ID');
      return;
    }
    
    try {
      const cached = imageCache.get(cameraId);
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=30' });
        res.end(cached.data);
        return;
      }
      
      const imageBuffer = await fetchCameraImage(cameraId);
      imageCache.set(cameraId, { data: imageBuffer, timestamp: Date.now() });
      
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=30' });
      res.end(imageBuffer);
      
    } catch (error) {
      const fallbackSvg = '<svg width="300" height="120" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="120" fill="#333"/><text x="150" y="60" font-family="Arial" fill="white" text-anchor="middle">Camera Unavailable</text></svg>';
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(fallbackSvg);
    }
    return;
  }
  
  // Health check
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      zones: tessellationZones.length,
      cameras: camerasData.length,
      uptime: Math.round(process.uptime())
    }));
    return;
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Start server
loadTessellationData().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Enhanced Camera Proxy Server running on http://localhost:${PORT}`);
    console.log(`🗽 DEV DASHBOARD: http://localhost:${PORT}/dev-dashboard`);
    console.log(`📊 Zones API: http://localhost:${PORT}/api/zones`);
    console.log(`🎯 Zone analytics: http://localhost:${PORT}/api/zone-analytics/{cameraId}`);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  server.close(() => process.exit(0));
}); 