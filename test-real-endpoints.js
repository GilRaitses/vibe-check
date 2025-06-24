#!/usr/bin/env node

const fetch = require('node-fetch');
const fs = require('fs');

const API_BASE = 'https://us-central1-vibe-check-463816.cloudfunctions.net/api';

// ACTUAL endpoints that exist in Firebase Functions
const REAL_ENDPOINTS = [
    // Basic System
    { category: 'System', endpoint: '/health', method: 'GET' },
    { category: 'System', endpoint: '/status', method: 'GET' },
    
    // Zone Analytics (WORKING)
    { category: 'Zone Analytics', endpoint: '/get-metrics/MN_001', method: 'GET' },
    { category: 'Zone Analytics', endpoint: '/get-metrics/BK_042', method: 'GET' },
    { category: 'Zone Analytics', endpoint: '/get-metrics/QN_123', method: 'GET' },
    { category: 'Zone Analytics', endpoint: '/metrics/dashboard', method: 'GET' },
    { category: 'Zone Analytics', endpoint: '/metrics/location/MN_001', method: 'GET' },
    { category: 'Zone Analytics', endpoint: '/metrics/recent-analysis', method: 'GET' },
    { category: 'Zone Analytics', endpoint: '/metrics/calculate-trends', method: 'GET' },
    
    // Camera Network (REAL ENDPOINTS)
    { category: 'Camera Network', endpoint: '/camera-network', method: 'GET' },
    { category: 'Camera Network', endpoint: '/voronoi-map', method: 'GET' },
    { category: 'Camera Network', endpoint: '/dashboard/camera-zones', method: 'GET' },
    { category: 'Camera Network', endpoint: '/dashboard/map-zones', method: 'GET' },
    { category: 'Camera Network', endpoint: '/dashboard/camera/MN_001/image', method: 'GET' },
    { category: 'Camera Network', endpoint: '/dashboard/camera/BK_042/image', method: 'GET' },
    
    // Territory Analysis
    { category: 'Territory', endpoint: '/territory/MN_001', method: 'GET' },
    { category: 'Territory', endpoint: '/territory/BK_042', method: 'GET' },
    
    // Monitoring System
    { category: 'Monitoring', endpoint: '/monitoring/status', method: 'GET' },
    { category: 'Monitoring', endpoint: '/monitoring/status-enhanced', method: 'GET' },
    { category: 'Monitoring', endpoint: '/monitoring/schedule/MN_001', method: 'GET' },
    { category: 'Monitoring', endpoint: '/monitoring/timeseries/MN_001', method: 'GET' },
    
    // ML Analytics (CORRECTED)
    { category: 'ML Analytics', endpoint: '/ml-stats', method: 'GET' },
    { category: 'ML Analytics', endpoint: '/ml-forecast/MN_001', method: 'GET' },
    { category: 'ML Analytics', endpoint: '/ml-forecast/BK_042', method: 'GET' },
    
    // Metrics & Charts
    { category: 'Metrics', endpoint: '/metrics/charts/violation-rates', method: 'GET' },
    { category: 'Metrics', endpoint: '/metrics/charts/trend-analysis', method: 'GET' },
    { category: 'Metrics', endpoint: '/metrics/charts/location-comparison', method: 'GET' },
    { category: 'Metrics', endpoint: '/metrics/charts/time-series', method: 'GET' },
    
    // Recent Data
    { category: 'Recent Data', endpoint: '/alerts/recent', method: 'GET' },
    { category: 'Recent Data', endpoint: '/retention-status', method: 'GET' },
    { category: 'Recent Data', endpoint: '/backup-status', method: 'GET' },
    
    // Test Endpoints
    { category: 'Testing', endpoint: '/test-collection/analyses', method: 'GET' },
    { category: 'Testing', endpoint: '/test-collection/reports', method: 'GET' },
    { category: 'Testing', endpoint: '/query-performance-test', method: 'GET' },
];

async function testEndpoint(endpoint) {
    const url = `${API_BASE}${endpoint.endpoint}`;
    
    try {
        console.log(`Testing: ${endpoint.method} ${endpoint.endpoint}`);
        
        const response = await fetch(url, {
            method: endpoint.method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Vibe-Check-Real-Endpoint-Tester/1.0'
            },
            timeout: 15000 // 15 second timeout for slow endpoints
        });
        
        const status = response.status;
        const statusText = response.statusText;
        
        let responseData;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            try {
                responseData = await response.json();
            } catch (e) {
                responseData = 'Invalid JSON response';
            }
        } else {
            responseData = await response.text();
        }
        
        return {
            ...endpoint,
            url,
            status,
            statusText,
            success: response.ok,
            responseData,
            responseSize: JSON.stringify(responseData).length,
            error: null
        };
        
    } catch (error) {
        return {
            ...endpoint,
            url,
            status: null,
            statusText: null,
            success: false,
            responseData: null,
            responseSize: 0,
            error: error.message
        };
    }
}

async function runRealTests() {
    console.log('🔍 TESTING REAL FIREBASE FUNCTIONS ENDPOINTS');
    console.log('=============================================');
    console.log(`Base URL: ${API_BASE}`);
    console.log(`Testing ${REAL_ENDPOINTS.length} actual endpoints...\n`);
    
    const results = [];
    const startTime = Date.now();
    
    // Test all endpoints
    for (const endpoint of REAL_ENDPOINTS) {
        const result = await testEndpoint(endpoint);
        results.push(result);
        
        // Show immediate feedback
        const statusEmoji = result.success ? '✅' : '❌';
        const statusCode = result.status ? `[${result.status}]` : '[NETWORK ERROR]';
        console.log(`${statusEmoji} ${statusCode} ${endpoint.category}: ${endpoint.endpoint}`);
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Generate summary report
    console.log('\n📊 REAL ENDPOINTS SUMMARY');
    console.log('=========================');
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`Total endpoints tested: ${results.length}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    console.log(`⏱️ Total time: ${totalTime}ms`);
    console.log(`📈 Success rate: ${((successCount / results.length) * 100).toFixed(1)}%`);
    
    // Group by category
    console.log('\n📂 BY CATEGORY (REAL ENDPOINTS)');
    console.log('================================');
    
    const categories = {};
    results.forEach(result => {
        if (!categories[result.category]) {
            categories[result.category] = { success: 0, total: 0, endpoints: [] };
        }
        categories[result.category].total++;
        if (result.success) categories[result.category].success++;
        categories[result.category].endpoints.push(result);
    });
    
    Object.keys(categories).forEach(category => {
        const cat = categories[category];
        const rate = ((cat.success / cat.total) * 100).toFixed(0);
        console.log(`${category}: ${cat.success}/${cat.total} working (${rate}%)`);
    });
    
    // Show camera image endpoints specifically
    console.log('\n📸 CAMERA IMAGE ENDPOINTS');
    console.log('=========================');
    const cameraEndpoints = results.filter(r => r.endpoint.includes('camera') && r.endpoint.includes('image'));
    cameraEndpoints.forEach(result => {
        const status = result.success ? '✅ WORKING' : '❌ BROKEN';
        console.log(`${status}: ${result.endpoint} [${result.status || 'ERROR'}]`);
    });
    
    // Generate corrected endpoint list for demo
    console.log('\n🔧 CORRECTED ENDPOINTS FOR YOUR DEMO');
    console.log('====================================');
    
    const workingEndpoints = results.filter(r => r.success);
    const cameraImageEndpoints = workingEndpoints.filter(r => r.endpoint.includes('image'));
    const zoneEndpoints = workingEndpoints.filter(r => r.endpoint.includes('get-metrics'));
    const systemEndpoints = workingEndpoints.filter(r => r.category === 'System');
    
    console.log('\n✅ WORKING CAMERA IMAGE ENDPOINTS:');
    cameraImageEndpoints.forEach(ep => console.log(`   ${ep.endpoint}`));
    
    console.log('\n✅ WORKING ZONE ANALYTICS:');
    zoneEndpoints.forEach(ep => console.log(`   ${ep.endpoint}`));
    
    console.log('\n✅ WORKING SYSTEM STATUS:');
    systemEndpoints.forEach(ep => console.log(`   ${ep.endpoint}`));
    
    // Save corrected endpoints for demo updates
    const correctedEndpoints = {
        cameraImage: cameraImageEndpoints.map(e => e.endpoint),
        zoneAnalytics: zoneEndpoints.map(e => e.endpoint),
        systemStatus: systemEndpoints.map(e => e.endpoint),
        allWorking: workingEndpoints.map(e => e.endpoint)
    };
    
    fs.writeFileSync('corrected-endpoints.json', JSON.stringify(correctedEndpoints, null, 2));
    console.log('\n💾 Corrected endpoints saved to: corrected-endpoints.json');
    
    // Save full results
    const reportData = {
        timestamp: new Date().toISOString(),
        baseUrl: API_BASE,
        summary: {
            total: results.length,
            successful: successCount,
            failed: failureCount,
            successRate: ((successCount / results.length) * 100).toFixed(1),
            totalTime: totalTime
        },
        categories,
        results,
        correctedEndpoints
    };
    
    const reportFile = `real-endpoint-test-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
    console.log(`💾 Detailed report saved to: ${reportFile}`);
    
    return results;
}

// Run the tests
if (require.main === module) {
    runRealTests().catch(console.error);
}

module.exports = { runRealTests, testEndpoint, REAL_ENDPOINTS }; 