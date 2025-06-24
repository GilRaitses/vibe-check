#!/usr/bin/env node

const fs = require('fs');

function analyzeEndpoints() {
    console.log('🔍 ENDPOINT REDUNDANCY & OBSOLESCENCE ANALYSIS');
    console.log('='.repeat(60));
    
    // Read our endpoint test results
    const testResults = JSON.parse(fs.readFileSync('real-endpoint-test-report-1750793121785.json', 'utf8'));
    
    // Categorize endpoints by function
    const endpointCategories = {
        metrics: [],
        camera: [],
        monitoring: [],
        territory: [],
        dashboard: [],
        system: [],
        ml: [],
        testing: []
    };
    
    // Group endpoints by category
    testResults.results.forEach(result => {
        const endpoint = result.endpoint;
        
        if (endpoint.includes('metrics') || endpoint.includes('get-metrics')) {
            endpointCategories.metrics.push(result);
        } else if (endpoint.includes('camera') || endpoint.includes('voronoi')) {
            endpointCategories.camera.push(result);
        } else if (endpoint.includes('monitoring')) {
            endpointCategories.monitoring.push(result);
        } else if (endpoint.includes('territory')) {
            endpointCategories.territory.push(result);
        } else if (endpoint.includes('dashboard')) {
            endpointCategories.dashboard.push(result);
        } else if (endpoint.includes('health') || endpoint.includes('status')) {
            endpointCategories.system.push(result);
        } else if (endpoint.includes('ml-')) {
            endpointCategories.ml.push(result);
        } else if (endpoint.includes('test-') || endpoint.includes('query-performance')) {
            endpointCategories.testing.push(result);
        }
    });
    
    console.log('\n📊 ENDPOINT ANALYSIS BY CATEGORY:');
    console.log('='.repeat(40));
    
    // Analyze each category
    Object.entries(endpointCategories).forEach(([category, endpoints]) => {
        if (endpoints.length === 0) return;
        
        console.log(`\n🔸 ${category.toUpperCase()} ENDPOINTS (${endpoints.length}):`);
        
        endpoints.forEach(ep => {
            const status = ep.success ? '✅' : '❌';
            console.log(`   ${status} ${ep.endpoint} [${ep.status}]`);
        });
    });
    
    console.log('\n🚨 REDUNDANCY ANALYSIS:');
    console.log('='*30);
    
    // Analyze metrics endpoints for redundancy
    console.log('\n📈 METRICS ENDPOINTS - REDUNDANCY DETECTED:');
    const metricsEndpoints = endpointCategories.metrics;
    
    console.log(`   Found ${metricsEndpoints.length} metrics endpoints:`);
    metricsEndpoints.forEach(ep => {
        console.log(`     - ${ep.endpoint}`);
    });
    
    console.log('\n   🔄 REDUNDANCY ISSUES:');
    console.log('     - /get-metrics/{id} vs /metrics/location/{id} - SAME FUNCTION');
    console.log('     - Multiple metrics/charts/* endpoints - COULD BE CONSOLIDATED');
    console.log('     - /metrics/dashboard vs /dashboard/camera-zones - OVERLAP');
    
    // Analyze camera endpoints
    console.log('\n📸 CAMERA ENDPOINTS - DEPENDENCY ISSUES:');
    const cameraEndpoints = endpointCategories.camera;
    
    console.log(`   Found ${cameraEndpoints.length} camera endpoints:`);
    cameraEndpoints.forEach(ep => {
        console.log(`     - ${ep.endpoint} [${ep.success ? 'WORKS' : 'BROKEN'}]`);
    });
    
    console.log('\n   🚨 DEPENDENCY ISSUES:');
    console.log('     - /camera-network - Depends on missing camera_networks collection');
    console.log('     - /voronoi-map - Depends on missing voronoi_territories collection');
    console.log('     - /dashboard/camera/*/image - Depends on missing imageUrls');
    
    // Analyze monitoring endpoints
    console.log('\n📊 MONITORING ENDPOINTS - STATUS CONFUSION:');
    const monitoringEndpoints = endpointCategories.monitoring;
    
    console.log(`   Found ${monitoringEndpoints.length} monitoring endpoints:`);
    monitoringEndpoints.forEach(ep => {
        console.log(`     - ${ep.endpoint} [${ep.success ? 'WORKS' : 'BROKEN'}]`);
    });
    
    console.log('\n   🔄 REDUNDANCY/CONFUSION:');
    console.log('     - /monitoring/status vs /monitoring/status-enhanced - UNCLEAR DIFFERENCE');
    console.log('     - /status vs /health vs /monitoring/status - TOO MANY STATUS ENDPOINTS');
    
    console.log('\n💀 OBSOLETE ENDPOINTS TO REMOVE:');
    console.log('='*35);
    
    const obsoleteEndpoints = [
        {
            endpoint: '/camera-network',
            reason: 'Depends on missing camera_networks collection that was never populated',
            action: 'REMOVE or replace with endpoint that uses monitoring_schedules'
        },
        {
            endpoint: '/voronoi-map', 
            reason: 'Depends on missing voronoi_territories collection',
            action: 'REMOVE or replace with data from zone-lookup.json'
        },
        {
            endpoint: '/territory/*',
            reason: 'Depends on missing collections and unclear purpose',
            action: 'REMOVE or consolidate with zone analytics'
        },
        {
            endpoint: '/metrics/location/{id}',
            reason: 'Identical to /get-metrics/{id} - pure redundancy',
            action: 'REMOVE - keep /get-metrics only'
        },
        {
            endpoint: '/monitoring/status-enhanced',
            reason: 'Unclear difference from /monitoring/status',
            action: 'REMOVE or merge into /monitoring/status'
        }
    ];
    
    obsoleteEndpoints.forEach((item, i) => {
        console.log(`\n${i+1}. ${item.endpoint}`);
        console.log(`   Reason: ${item.reason}`);
        console.log(`   Action: ${item.action}`);
    });
    
    console.log('\n🔧 CONSOLIDATION OPPORTUNITIES:');
    console.log('='*35);
    
    const consolidations = [
        {
            group: 'Status Endpoints',
            current: ['/health', '/status', '/monitoring/status'],
            proposed: '/system/status',
            benefit: 'Single source of truth for system status'
        },
        {
            group: 'Metrics Charts',
            current: ['/metrics/charts/violation-rates', '/metrics/charts/trend-analysis', '/metrics/charts/location-comparison', '/metrics/charts/time-series'],
            proposed: '/metrics/charts?type={violation-rates|trends|comparison|timeseries}',
            benefit: 'Single endpoint with query parameters'
        },
        {
            group: 'Camera Data',
            current: ['/dashboard/camera-zones', '/dashboard/map-zones'],
            proposed: '/cameras?include={zones|map|analytics}',
            benefit: 'Flexible camera data endpoint'
        }
    ];
    
    consolidations.forEach((item, i) => {
        console.log(`\n${i+1}. ${item.group}:`);
        console.log(`   Current: ${item.current.join(', ')}`);
        console.log(`   Proposed: ${item.proposed}`);
        console.log(`   Benefit: ${item.benefit}`);
    });
    
    console.log('\n📋 RECOMMENDED ACTIONS:');
    console.log('='*25);
    
    console.log('\n1. 🗑️  IMMEDIATE REMOVAL:');
    console.log('   - Remove endpoints that depend on missing collections');
    console.log('   - Remove pure duplicates (/metrics/location/{id})');
    console.log('   - Remove unclear "enhanced" variants');
    
    console.log('\n2. 🔄 CONSOLIDATION:');
    console.log('   - Merge status endpoints into single /system/status');
    console.log('   - Consolidate metrics charts into parameterized endpoint');
    console.log('   - Unify camera data endpoints');
    
    console.log('\n3. 📊 DATA RESTORATION:');
    console.log('   - Restore 907 cameras to monitoring_schedules');
    console.log('   - Create camera_metadata from zone-lookup.json');
    console.log('   - Generate voronoi_territories from tessellation data');
    
    console.log('\n4. 🎯 ENDPOINT REDESIGN:');
    console.log('   - Use consistent naming: /cameras, /zones, /analytics');
    console.log('   - Add proper query parameters for filtering');
    console.log('   - Remove dependency on missing collections');
    
    // Calculate cleanup impact
    const totalEndpoints = testResults.results.length;
    const obsoleteCount = obsoleteEndpoints.length;
    const workingEndpoints = testResults.results.filter(r => r.success).length;
    
    console.log('\n📈 CLEANUP IMPACT:');
    console.log(`   Current endpoints: ${totalEndpoints}`);
    console.log(`   Obsolete to remove: ${obsoleteCount}`);
    console.log(`   Working endpoints: ${workingEndpoints}`);
    console.log(`   After cleanup: ${totalEndpoints - obsoleteCount} endpoints`);
    console.log(`   Success rate improvement: Focus on ${workingEndpoints} proven endpoints`);
}

analyzeEndpoints(); 