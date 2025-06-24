const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const imageCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

console.log('🚀 Starting simple camera proxy server...');

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
  
  // Handle camera image proxy
  if (pathname.startsWith('/api/camera-image/')) {
    const cameraId = pathname.split('/api/camera-image/')[1];
    
    if (!cameraId) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing camera ID');
      return;
    }
    
    console.log(`📸 Request for camera: ${cameraId}`);
    
    try {
      // Check cache first
      const cached = imageCache.get(cameraId);
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log(`📸 Cache hit for camera ${cameraId}`);
        res.writeHead(200, { 
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=30'
        });
        res.end(cached.data);
        return;
      }
      
      console.log(`📸 Fetching fresh image for camera ${cameraId}...`);
      
      const imageBuffer = await fetchCameraImage(cameraId);
      
      // Cache the image
      imageCache.set(cameraId, {
        data: imageBuffer,
        timestamp: Date.now()
      });
      
      console.log(`✅ Successfully fetched image for ${cameraId} (${imageBuffer.length} bytes)`);
      
      res.writeHead(200, { 
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=30'
      });
      res.end(imageBuffer);
      
    } catch (error) {
      console.error(`❌ Error fetching camera ${cameraId}:`, error.message);
      
      // Return fallback SVG
      const fallbackSvg = `
        <svg width="300" height="120" xmlns="http://www.w3.org/2000/svg">
          <rect width="300" height="120" fill="#333"/>
          <text x="150" y="50" font-family="Arial" font-size="14" fill="white" text-anchor="middle">
            Camera ${cameraId.substring(0, 8)}...
          </text>
          <text x="150" y="70" font-family="Arial" font-size="10" fill="#ff4444" text-anchor="middle">
            Image Unavailable
          </text>
        </svg>
      `;
      
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(fallbackSvg);
    }
    return;
  }
  
  // Health check
  if (pathname === '/api/health') {
    const health = {
      status: 'ok',
      cached_images: imageCache.size,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
    return;
  }
  
  // Test endpoint
  if (pathname === '/api/test') {
    const testCameraId = '9bd74b87-32d1-4767-8081-86a2e83f28f2';
    console.log(`🧪 Testing camera ${testCameraId}...`);
    
    try {
      const imageBuffer = await fetchCameraImage(testCameraId);
      const result = {
        success: true,
        imageSize: imageBuffer.length,
        proxyUrl: `http://localhost:${PORT}/api/camera-image/${testCameraId}`
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result, null, 2));
    } catch (error) {
      const result = {
        success: false,
        error: error.message
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result, null, 2));
    }
    return;
  }
  
  // Serve static files
  if (pathname.startsWith('/data/') || pathname.startsWith('/public/')) {
    const filePath = path.join(__dirname, pathname);
    try {
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        const contentType = ext === '.json' ? 'application/json' : 
                           ext === '.html' ? 'text/html' : 
                           ext === '.js' ? 'application/javascript' : 
                           'text/plain';
        
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        return;
      }
    } catch (error) {
      console.error(`Error serving ${filePath}:`, error.message);
    }
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`🚀 Camera Proxy Server running on http://localhost:${PORT}`);
  console.log(`📸 Camera images: /api/camera-image/{cameraId}`);
  console.log(`🧪 Test: http://localhost:${PORT}/api/test`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}/public/borough-dashboard.html`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  server.close(() => {
    process.exit(0);
  });
}); 