#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = __dirname;
const SERVER_URL = 'http://10.4.32.157:3001';
const LOG_DIR = path.join(BACKUP_DIR, 'territory-server', 'access-logs');
const PERF_DIR = path.join(BACKUP_DIR, 'territory-server', 'performance');

// Ensure directories exist
fs.mkdirSync(LOG_DIR, { recursive: true });
fs.mkdirSync(PERF_DIR, { recursive: true });

console.log('🔍 [MONITOR] Starting territory server monitoring...');
console.log(`📊 [MONITOR] Server: ${SERVER_URL}`);
console.log(`📁 [MONITOR] Logs: ${LOG_DIR}`);
console.log(`📈 [MONITOR] Performance: ${PERF_DIR}`);

class ServerMonitor {
  constructor() {
    this.logFile = path.join(LOG_DIR, `access-${new Date().toISOString().split('T')[0]}.log`);
    this.perfFile = path.join(PERF_DIR, `performance-${new Date().toISOString().split('T')[0]}.json`);
    this.stats = {
      requests: 0,
      territories_served: 0,
      status_checks: 0,
      total_data_mb: 0,
      avg_response_time: 0,
      response_times: [],
      mobile_connections: 0,
      start_time: new Date().toISOString()
    };
    
    this.startMonitoring();
  }
  
  async startMonitoring() {
    console.log('🚀 [MONITOR] Monitoring started - checking server every 30 seconds');
    
    // Initial server check
    await this.checkServer();
    
    // Set up periodic monitoring
    setInterval(async () => {
      await this.checkServer();
    }, 30000); // Check every 30 seconds
    
    // Save performance stats every 5 minutes
    setInterval(() => {
      this.savePerformanceStats();
    }, 300000); // 5 minutes
  }
  
  async checkServer() {
    const timestamp = new Date().toISOString();
    
    try {
      // Test server status
      const startTime = Date.now();
      const response = await fetch(`${SERVER_URL}/status`);
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const status = await response.json();
        
        // Log successful check
        this.logActivity(`${timestamp} - STATUS_CHECK - ${responseTime}ms - Server running`);
        
        // Update stats
        this.stats.requests++;
        this.stats.status_checks++;
        this.stats.response_times.push(responseTime);
        this.stats.avg_response_time = this.stats.response_times.reduce((a, b) => a + b, 0) / this.stats.response_times.length;
        
        // Keep only last 100 response times for average
        if (this.stats.response_times.length > 100) {
          this.stats.response_times = this.stats.response_times.slice(-100);
        }
        
        console.log(`✅ [MONITOR] Server check OK - ${responseTime}ms - ${this.stats.requests} total requests`);
        
        // Check if territories endpoint is being used
        await this.checkTerritoriesUsage();
        
      } else {
        this.logActivity(`${timestamp} - STATUS_ERROR - ${response.status} ${response.statusText}`);
        console.warn(`⚠️ [MONITOR] Server returned ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      this.logActivity(`${timestamp} - CONNECTION_ERROR - ${error.message}`);
      console.error(`❌ [MONITOR] Could not connect to server: ${error.message}`);
    }
  }
  
  async checkTerritoriesUsage() {
    // This is just a test - in real monitoring, this would track actual mobile app requests
    try {
      const startTime = Date.now();
      const response = await fetch(`${SERVER_URL}/territories`, { method: 'HEAD' }); // HEAD request to check without downloading
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const contentLength = response.headers.get('content-length');
        const dataSizeMB = contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) : 'unknown';
        
        this.logActivity(`${new Date().toISOString()} - TERRITORIES_AVAILABLE - ${responseTime}ms - ${dataSizeMB}MB ready`);
        
        // This would normally be triggered by actual mobile app requests
        // For now, we just log that the endpoint is available
      }
    } catch (error) {
      console.warn(`⚠️ [MONITOR] Territories endpoint check failed: ${error.message}`);
    }
  }
  
  logActivity(message) {
    // Append to daily log file
    fs.appendFileSync(this.logFile, message + '\n');
  }
  
  logMobileConnection(userAgent, ipAddress) {
    const timestamp = new Date().toISOString();
    const message = `${timestamp} - MOBILE_CONNECTION - ${ipAddress} - ${userAgent}`;
    
    this.logActivity(message);
    this.stats.mobile_connections++;
    this.stats.territories_served++;
    
    console.log(`📱 [MONITOR] Mobile app connected: ${ipAddress}`);
  }
  
  savePerformanceStats() {
    const timestamp = new Date().toISOString();
    
    // Calculate uptime
    const startTime = new Date(this.stats.start_time);
    const uptime = Date.now() - startTime.getTime();
    const uptimeHours = (uptime / (1000 * 60 * 60)).toFixed(2);
    
    const performanceData = {
      ...this.stats,
      uptime_hours: uptimeHours,
      last_updated: timestamp,
      requests_per_hour: (this.stats.requests / uptimeHours).toFixed(2)
    };
    
    fs.writeFileSync(this.perfFile, JSON.stringify(performanceData, null, 2));
    
    console.log(`📊 [MONITOR] Performance stats saved - ${this.stats.requests} requests in ${uptimeHours}h`);
  }
  
  // Simulate mobile app connection (for testing)
  simulateMobileConnection() {
    this.logMobileConnection('React Native App', '10.4.32.XXX');
    
    // Simulate territory data transfer
    const dataSizeMB = 0.465; // 465KB
    this.stats.total_data_mb += dataSizeMB;
    
    console.log(`📱 [MONITOR] Simulated mobile connection - ${this.stats.total_data_mb.toFixed(2)}MB total served`);
  }
}

// Start monitoring
const monitor = new ServerMonitor();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 [MONITOR] Stopping server monitoring...');
  monitor.savePerformanceStats();
  console.log('✅ [MONITOR] Final performance stats saved');
  process.exit(0);
});

// Simulate mobile connections for testing (remove in production)
setInterval(() => {
  if (Math.random() > 0.8) { // 20% chance every minute
    monitor.simulateMobileConnection();
  }
}, 60000); // Every minute

console.log('⏹️  [MONITOR] Press Ctrl+C to stop monitoring'); 