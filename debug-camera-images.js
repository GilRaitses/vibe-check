#!/usr/bin/env node

const fetch = require('node-fetch');

const API_BASE = 'https://us-central1-vibe-check-463816.cloudfunctions.net/api';

async function debugCameraImages() {
    try {
        console.log('🔍 DEBUGGING CAMERA IMAGE ENDPOINTS');
        console.log('===================================\n');
        
        console.log('Fetching camera list...');
        
        // First, get list of real camera IDs
        const dashboardResponse = await fetch(`${API_BASE}/dashboard/camera-zones`);
        console.log(`Dashboard response status: ${dashboardResponse.status}`);
        
        if (!dashboardResponse.ok) {
            throw new Error(`Dashboard API failed: ${dashboardResponse.status} ${dashboardResponse.statusText}`);
        }
        
        const dashboardData = await dashboardResponse.json();
        const cameras = dashboardData.dashboard_data.camera_zones;
        console.log(`✅ Found ${cameras.length} cameras\n`);
        
        // Test first 3 cameras only to avoid too much output
        for (let i = 0; i < Math.min(3, cameras.length); i++) {
            const camera = cameras[i];
            console.log(`📸 [${i+1}/${Math.min(3, cameras.length)}] Testing: ${camera.camera_id}`);
            console.log(`   Name: ${camera.camera_name}`);
            console.log(`   URL: ${API_BASE}/dashboard/camera/${camera.camera_id}/image`);
            
            try {
                const imageResponse = await fetch(`${API_BASE}/dashboard/camera/${camera.camera_id}/image`);
                
                console.log(`   Status: ${imageResponse.status} ${imageResponse.statusText}`);
                console.log(`   Content-Type: ${imageResponse.headers.get('content-type')}`);
                console.log(`   Content-Length: ${imageResponse.headers.get('content-length')}`);
                
                if (imageResponse.status === 404) {
                    const errorData = await imageResponse.json();
                    console.log(`   ❌ Error: ${errorData.error}`);
                } else if (imageResponse.status === 200) {
                    const contentType = imageResponse.headers.get('content-type');
                    if (contentType && contentType.includes('image')) {
                        console.log(`   ✅ Valid image returned!`);
                    } else {
                        const text = await imageResponse.text();
                        console.log(`   ❌ Not an image - got ${contentType || 'unknown'}`);
                        if (text.includes('<html')) {
                            console.log(`   Content: HTML page (${text.length} chars)`);
                        } else {
                            console.log(`   Content preview: ${text.substring(0, 200)}...`);
                        }
                    }
                } else {
                    const errorText = await imageResponse.text();
                    console.log(`   ❌ Error ${imageResponse.status}: ${errorText}`);
                }
                
            } catch (error) {
                console.log(`   ❌ Network error: ${error.message}`);
            }
            
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ Script error:', error.message);
        console.error(error.stack);
    }
}

debugCameraImages(); 