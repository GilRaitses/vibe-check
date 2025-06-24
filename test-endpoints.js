#!/usr/bin/env node

const fetch = require('node-fetch');
const fs = require('fs');

const API_BASE = 'https://us-central1-vibe-check-463816.cloudfunctions.net/api';

// All endpoints to test
const ENDPOINTS = [
    // Zone Analytics
    { category: 'Zone Analytics', endpoint: '/get-metrics/MN_001', method: 'GET' },
    { category: 'Zone Analytics', endpoint: '/get-metrics/BK_042', method: 'GET' },
    { category: 'Zone Analytics', endpoint: '/get-metrics/QN_123', method: 'GET' },
    { category: 'Zone Analytics', endpoint: '/get-metrics/SI_001', method: 'GET' },
    { category: 'Zone Analytics', endpoint: '/get-metrics/BX_001', method: 'GET' },
    
    // Camera Network
    { category: 'Camera Network', endpoint: '/get-camera-image/MN_001', method: 'GET' },
    { category: 'Camera Network', endpoint: '/get-camera-image/BK_042', method: 'GET' },
    { category: 'Camera Network', endpoint: '/camera-network', method: 'GET' },
    { category: 'Camera Network', endpoint: '/voronoi-map', method: 'GET' },
    { category: 'Camera Network', endpoint: '/territory/MN_001', method: 'GET' },
    
    // Monitoring Dashboard
    { category: 'Monitoring', endpoint: '/monitoring-dashboard', method: 'GET' },
    { category: 'Monitoring', endpoint: '/system-status', method: 'GET' },
    { category: 'Monitoring', endpoint: '/health-check', method: 'GET' },
    
    // ML Analytics
    { category: 'ML Analytics', endpoint: '/ml-model-stats', method: 'GET' },
    { category: 'ML Analytics', endpoint: '/violation-forecast/MN_001', method: 'GET' },
    { category: 'ML Analytics', endpoint: '/critical-zones', method: 'GET' },
    
    // Additional endpoints that might exist
    { category: 'Vision Analysis', endpoint: '/analyze-image/MN_001', method: 'GET' },
    { category: 'Vision Analysis', endpoint: '/get-analysis/MN_001', method: 'GET' },
    { category: 'Vision Analysis', endpoint: '/vision-analysis', method: 'GET' },
    
    // Adaptive Monitoring
    { category: 'Adaptive Monitoring', endpoint: '/adaptive-monitoring', method: 'GET' },
    { category: 'Adaptive Monitoring', endpoint: '/sampling-frequencies', method: 'GET' },
    { category: 'Adaptive Monitoring', endpoint: '/update-monitoring/MN_001', method: 'GET' },
];

async function testEndpoint(endpoint) {
    const url = `${API_BASE}${endpoint.endpoint}`;
    
    try {
        console.log(`Testing: ${endpoint.method} ${endpoint.endpoint}`);
        
        const response = await fetch(url, {
            method: endpoint.method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Vibe-Check-Endpoint-Tester/1.0'
            },
            timeout: 10000 // 10 second timeout
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

async function runAllTests() {
    console.log('🔍 FIREBASE FUNCTIONS ENDPOINT TESTING');
    console.log('=====================================');
    console.log(`Base URL: ${API_BASE}`);
    console.log(`Testing ${ENDPOINTS.length} endpoints...\n`);
    
    const results = [];
    const startTime = Date.now();
    
    // Test all endpoints
    for (const endpoint of ENDPOINTS) {
        const result = await testEndpoint(endpoint);
        results.push(result);
        
        // Show immediate feedback
        const statusEmoji = result.success ? '✅' : '❌';
        const statusCode = result.status ? `[${result.status}]` : '[NETWORK ERROR]';
        console.log(`${statusEmoji} ${statusCode} ${endpoint.category}: ${endpoint.endpoint}`);
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Generate summary report
    console.log('\n📊 SUMMARY REPORT');
    console.log('==================');
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`Total endpoints tested: ${results.length}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    console.log(`⏱️ Total time: ${totalTime}ms`);
    console.log(`📈 Success rate: ${((successCount / results.length) * 100).toFixed(1)}%`);
    
    // Group by category
    console.log('\n📂 BY CATEGORY');
    console.log('===============');
    
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
    
    // Show detailed failures
    console.log('\n🚨 DETAILED FAILURES');
    console.log('====================');
    
    const failures = results.filter(r => !r.success);
    if (failures.length === 0) {
        console.log('🎉 No failures - all endpoints working!');
    } else {
        failures.forEach(failure => {
            console.log(`\n❌ ${failure.endpoint}`);
            console.log(`   URL: ${failure.url}`);
            console.log(`   Status: ${failure.status || 'NETWORK ERROR'}`);
            console.log(`   Error: ${failure.error || failure.statusText}`);
            if (failure.responseData && typeof failure.responseData === 'string') {
                console.log(`   Response: ${failure.responseData.substring(0, 200)}...`);
            }
        });
    }
    
    // Show working endpoints with data
    console.log('\n✅ WORKING ENDPOINTS');
    console.log('====================');
    
    const working = results.filter(r => r.success);
    working.forEach(success => {
        console.log(`\n✅ ${success.endpoint} [${success.status}]`);
        if (success.responseData && typeof success.responseData === 'object') {
            const keys = Object.keys(success.responseData);
            console.log(`   Response keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`);
            console.log(`   Data size: ${success.responseSize} bytes`);
        }
    });
    
    // Save results to file
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
        results
    };
    
    const reportFile = `endpoint-test-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportFile}`);
    
    return results;
}

// Run the tests
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = { runAllTests, testEndpoint, ENDPOINTS }; 