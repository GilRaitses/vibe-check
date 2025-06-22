#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3001;
const TERRITORIES_FILE = path.join(__dirname, '..', 'assets', 'precomputed-territories.json');

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      const { address, family, internal } = interface;
      if (family === 'IPv4' && !internal) {
        return address;
      }
    }
  }
  return '127.0.0.1';
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Enable CORS for mobile app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  console.log(`📱 [TERRITORY_SERVER] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  if (req.url === '/territories' && req.method === 'GET') {
    // Serve territories file
    try {
      if (!fs.existsSync(TERRITORIES_FILE)) {
        console.error(`❌ [TERRITORY_SERVER] Territories file not found: ${TERRITORIES_FILE}`);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Territories file not found' }));
        return;
      }
      
      const territoriesData = fs.readFileSync(TERRITORIES_FILE, 'utf8');
      const dataSize = (territoriesData.length / 1024 / 1024).toFixed(2);
      
      console.log(`📦 [TERRITORY_SERVER] Serving territories (${dataSize} MB)`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(territoriesData);
      
    } catch (error) {
      console.error(`❌ [TERRITORY_SERVER] Error reading territories file:`, error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read territories file' }));
    }
  } else if (req.url === '/status' && req.method === 'GET') {
    // Health check endpoint
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'running',
      timestamp: new Date().toISOString(),
      territoriesFile: fs.existsSync(TERRITORIES_FILE) ? 'found' : 'missing'
    }));
  } else {
    // 404 for other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
});

// Start server
server.listen(PORT, () => {
  const localIP = getLocalIP();
  console.log('🚀 [TERRITORY_SERVER] NYC Safety App Territory Server Started!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🌐 [TERRITORY_SERVER] Server running on port ${PORT}`);
  console.log(`📍 [TERRITORY_SERVER] Local access: http://localhost:${PORT}`);
  console.log(`📱 [TERRITORY_SERVER] Mobile access: http://${localIP}:${PORT}`);
  console.log(`📁 [TERRITORY_SERVER] Serving territories from: ${TERRITORIES_FILE}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📋 [TERRITORY_SERVER] Available endpoints:');
  console.log(`   GET /territories - Serve NYC camera territories data`);
  console.log(`   GET /status      - Server health check`);
  console.log('');
  console.log('📝 [TERRITORY_SERVER] Next steps:');
  console.log(`   1. Update voronoiLoader.ts LOCAL_SERVER_URL to: http://${localIP}:${PORT}`);
  console.log(`   2. Make sure your phone and computer are on the same network`);
  console.log(`   3. Start your React Native app`);
  console.log('');
  console.log('⏹️  [TERRITORY_SERVER] Press Ctrl+C to stop the server');
  console.log('');
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 [TERRITORY_SERVER] Shutting down server...');
  server.close(() => {
    console.log('✅ [TERRITORY_SERVER] Server stopped successfully');
    process.exit(0);
  });
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ [TERRITORY_SERVER] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [TERRITORY_SERVER] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
}); 