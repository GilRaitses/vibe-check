#!/usr/bin/env node

const { exec } = require('child_process');
const os = require('os');
const path = require('path');

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

console.log('🔍 [SETUP] NYC Safety App Territory Server Setup');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const localIP = getLocalIP();
console.log(`📍 [SETUP] Your computer's IP address: ${localIP}`);
console.log(`🌐 [SETUP] Mobile app should connect to: http://${localIP}:3001`);
console.log('');

console.log('📝 [SETUP] Quick setup steps:');
console.log(`   1. Update voronoiLoader.ts line 6:`);
console.log(`      const LOCAL_SERVER_URL = 'http://${localIP}:3001';`);
console.log(`   2. Make sure your computer and phone are on the same WiFi network`);
console.log(`   3. This script will start the territory server`);
console.log('');

console.log('🚀 [SETUP] Starting territory server...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Start the territory server
const serverScript = path.join(__dirname, 'territory-server.js');
const serverProcess = exec(`node "${serverScript}"`, (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ [SETUP] Server error: ${error}`);
    return;
  }
  if (stderr) {
    console.error(`❌ [SETUP] Server stderr: ${stderr}`);
  }
});

// Pipe server output to console
serverProcess.stdout.on('data', (data) => {
  process.stdout.write(data);
});

serverProcess.stderr.on('data', (data) => {
  process.stderr.write(data);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 [SETUP] Stopping territory server...');
  serverProcess.kill('SIGINT');
  process.exit(0);
}); 