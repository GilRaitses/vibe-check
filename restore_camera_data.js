#!/usr/bin/env node

const fs = require('fs');
const fetch = require('node-fetch');

const FIREBASE_FUNCTIONS_URL = 'https://us-central1-vibe-check-463816.cloudfunctions.net/api';

// Known NYC Camera UUID mappings (we need to build this)
const HANDLE_TO_UUID_MAPPING = {
  // We'll populate this with real UUIDs
  // For now, let's use the one working UUID we found earlier
  '0bcfbc92-d455-4f62-846a-32afbefa3b4b': '0bcfbc92-d455-4f62-846a-32afbefa3b4b'
};

async function restoreCameraData() {
  console.log('🔧 RESTORING 907 CAMERAS TO FIRESTORE');
  console.log('='*50);
  
  try {
    // Load zone lookup data
    console.log('📂 Loading zone lookup data...');
    const zoneLookup = JSON.parse(fs.readFileSync('data/zone-lookup.json', 'utf8'));
    
    console.log(`✅ Found ${Object.keys(zoneLookup).length} cameras in zone-lookup.json`);
    
    // Analyze the camera handles
    const handles = new Set();
    const boroughCounts = {};
    
    Object.values(zoneLookup).forEach(zone => {
      if (zone.camera_handle) {
        handles.add(zone.camera_handle);
      }
      boroughCounts[zone.borough] = (boroughCounts[zone.borough] || 0) + 1;
    });
    
    console.log('\n📊 CAMERA DATA ANALYSIS:');
    console.log(`   Unique camera handles: ${handles.size}`);
    console.log('   Borough distribution:');
    Object.entries(boroughCounts).forEach(([borough, count]) => {
      console.log(`     ${borough}: ${count} cameras`);
    });
    
    // Show sample handles
    console.log('\n📸 SAMPLE CAMERA HANDLES:');
    Array.from(handles).slice(0, 10).forEach((handle, i) => {
      console.log(`   ${i+1}. ${handle}`);
    });
    
    console.log('\n🎯 NEXT STEPS NEEDED:');
    console.log('   1. Convert camera handles to NYC Traffic Camera UUIDs');
    console.log('   2. Create monitoring_schedules for all 907 cameras');
    console.log('   3. Add proper imageUrls with UUIDs');
    console.log('   4. Test camera image endpoints');
    
    // Let's test if any of our handles work as UUIDs
    console.log('\n🧪 TESTING SAMPLE HANDLES AS POTENTIAL UUIDS...');
    const testHandles = Array.from(handles).slice(0, 5);
    
    for (const handle of testHandles) {
      try {
        const testUrl = `https://webcams.nyctmc.org/api/cameras/${handle}/image`;
        const response = await fetch(testUrl, { 
          method: 'HEAD', 
          timeout: 5000 
        });
        
        console.log(`   ${handle}: ${response.status} ${response.statusText}`);
        
        if (response.status === 200) {
          console.log(`   ✅ ${handle} IS A VALID UUID!`);
          HANDLE_TO_UUID_MAPPING[handle] = handle;
        }
      } catch (error) {
        console.log(`   ${handle}: Network error`);
      }
    }
    
    if (Object.keys(HANDLE_TO_UUID_MAPPING).length > 1) {
      console.log(`\n✅ Found ${Object.keys(HANDLE_TO_UUID_MAPPING).length - 1} working UUIDs!`);
    } else {
      console.log('\n❌ No camera handles work as UUIDs directly');
      console.log('   Need to find UUID mapping from NYC TMC API');
    }
    
    // Generate the Firebase Functions update needed
    console.log('\n📝 CREATING SAMPLE MONITORING SCHEDULE DATA...');
    
    const sampleCameras = Object.entries(zoneLookup).slice(0, 3);
    const monitoringSchedules = [];
    
    for (const [cameraId, zoneInfo] of sampleCameras) {
      const schedule = {
        camera_id: `cam_${zoneInfo.zone_id.toLowerCase()}`,
        camera: {
          id: `cam_${zoneInfo.zone_id.toLowerCase()}`,
          name: zoneInfo.camera_name,
          latitude: zoneInfo.coordinates[1],
          longitude: zoneInfo.coordinates[0],
          imageUrl: zoneInfo.camera_handle && HANDLE_TO_UUID_MAPPING[zoneInfo.camera_handle] 
            ? `https://webcams.nyctmc.org/api/cameras/${zoneInfo.camera_handle}/image`
            : null,
          area: zoneInfo.borough,
          isOnline: true
        },
        neighborhood: zoneInfo.borough,
        zone_id: zoneInfo.zone_id,
        zone_classification: 'neighborhood_baseline',
        current_score: 24,
        sampling_frequency_hours: 24,
        frequency_tier: 'daily',
        is_baseline_camera: true,
        is_high_risk_zone: false,
        system_version: 'restored_v1'
      };
      
      monitoringSchedules.push(schedule);
    }
    
    // Save sample data
    fs.writeFileSync('monitoring_schedules_sample.json', JSON.stringify(monitoringSchedules, null, 2));
    console.log('\n💾 Sample monitoring schedules saved to: monitoring_schedules_sample.json');
    
    console.log('\n🚀 TO RESTORE ALL CAMERAS:');
    console.log('   1. Get NYC TMC Camera UUID list');
    console.log('   2. Map camera handles to UUIDs'); 
    console.log('   3. Create Firebase Function to bulk insert schedules');
    console.log('   4. Update all 907 cameras with proper imageUrls');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

restoreCameraData(); 