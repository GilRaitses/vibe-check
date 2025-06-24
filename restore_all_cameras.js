#!/usr/bin/env node

const fs = require('fs');

console.log('🚀 RESTORING ALL 907 CAMERAS TO FIRESTORE');
console.log('='*50);

async function restoreAllCameras() {
    try {
        // Load the zone lookup data with all 907 cameras
        console.log('📂 Loading zone-lookup.json...');
        const zoneLookup = JSON.parse(fs.readFileSync('data/zone-lookup.json', 'utf8'));
        
        console.log(`✅ Found ${Object.keys(zoneLookup).length} cameras in zone lookup`);
        
        // Create monitoring schedule data for ALL cameras
        const allSchedules = [];
        const boroughStats = {};
        
        Object.entries(zoneLookup).forEach(([cameraId, zoneInfo]) => {
            // Count by borough
            boroughStats[zoneInfo.borough] = (boroughStats[zoneInfo.borough] || 0) + 1;
            
            // Create monitoring schedule for each camera
            const schedule = {
                camera_id: `cam_${zoneInfo.zone_id.toLowerCase()}`,
                camera: {
                    id: `cam_${zoneInfo.zone_id.toLowerCase()}`,
                    name: zoneInfo.camera_name,
                    latitude: zoneInfo.coordinates[1], // coordinates are [lng, lat]
                    longitude: zoneInfo.coordinates[0],
                    // Note: imageUrl will be null until we get UUID mapping
                    imageUrl: null,
                    area: zoneInfo.borough,
                    handle: zoneInfo.camera_handle,
                    isOnline: true
                },
                neighborhood: zoneInfo.borough,
                zone_id: zoneInfo.zone_id,
                zone_classification: 'neighborhood_baseline',
                current_score: 24, // Start with daily baseline
                sampling_frequency_hours: 24,
                frequency_tier: 'daily',
                frequency_color: '#32cd32',
                is_baseline_camera: true,
                is_high_risk_zone: false,
                high_risk_reason: null,
                system_version: 'restored_v1',
                auto_escalated: false,
                adaptive_scores_history: [],
                violation_history: [],
                // Add zone metadata
                original_camera_id: cameraId,
                original_handle: zoneInfo.camera_handle,
                coordinates: zoneInfo.coordinates
            };
            
            allSchedules.push(schedule);
        });
        
        console.log('\\n📊 RESTORATION SUMMARY:');
        console.log(`   Total cameras to restore: ${allSchedules.length}`);
        console.log('   Borough distribution:');
        Object.entries(boroughStats).forEach(([borough, count]) => {
            console.log(`     ${borough}: ${count} cameras`);
        });
        
        // Save restoration data in batches
        const batchSize = 100;
        console.log(`\\n💾 Saving in batches of ${batchSize}...`);
        
        for (let i = 0; i < allSchedules.length; i += batchSize) {
            const batch = allSchedules.slice(i, i + batchSize);
            const filename = `monitoring_schedules_batch_${Math.floor(i/batchSize) + 1}.json`;
            
            fs.writeFileSync(filename, JSON.stringify(batch, null, 2));
            console.log(`   ✅ Saved batch ${Math.floor(i/batchSize) + 1}: ${batch.length} cameras → ${filename}`);
        }
        
        // Create complete restoration file
        fs.writeFileSync('monitoring_schedules_complete.json', JSON.stringify(allSchedules, null, 2));
        console.log(`\\n💾 Complete restoration data saved: monitoring_schedules_complete.json`);
        
        // Create Firebase Functions bulk import endpoint code
        const importEndpointCode = `
// Add this endpoint to Firebase Functions to bulk import all cameras
app.post('/restore-cameras', async (req, res) => {
  try {
    console.log('🚀 Starting bulk camera restoration...');
    
    const schedules = ${JSON.stringify(allSchedules, null, 4)};
    
    // Batch write to Firestore (500 docs max per batch)
    const batchSize = 500;
    let totalRestored = 0;
    
    for (let i = 0; i < schedules.length; i += batchSize) {
      const batch = db.batch();
      const currentBatch = schedules.slice(i, i + batchSize);
      
      currentBatch.forEach(schedule => {
        const docRef = db.collection('monitoring_schedules').doc(schedule.camera_id);
        batch.set(docRef, {
          ...schedule,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          last_updated: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      
      await batch.commit();
      totalRestored += currentBatch.length;
      console.log(\`✅ Restored batch \${Math.floor(i/batchSize) + 1}: \${totalRestored}/\${schedules.length} cameras\`);
    }
    
    return res.json({
      success: true,
      message: 'All cameras restored successfully',
      total_restored: totalRestored,
      borough_stats: ${JSON.stringify(boroughStats, null, 6)}
    });
    
  } catch (error) {
    console.error('❌ Camera restoration failed:', error);
    return res.status(500).json({
      error: 'Camera restoration failed',
      details: error.message
    });
  }
});`;
        
        fs.writeFileSync('firebase_restore_endpoint.js', importEndpointCode);
        console.log('\\n📝 Firebase endpoint code saved: firebase_restore_endpoint.js');
        
        console.log('\\n🎯 NEXT STEPS:');
        console.log('   1. Add the restore endpoint to Firebase Functions');
        console.log('   2. Deploy Firebase Functions');
        console.log('   3. Call POST /restore-cameras to bulk import all 907 cameras');
        console.log('   4. Verify all cameras are in monitoring_schedules collection');
        console.log('   5. Handle UUID mapping for image functionality');
        
        console.log('\\n🚀 RESTORATION READY!');
        console.log(`   Files created: ${Math.ceil(allSchedules.length/batchSize)} batch files + complete file`);
        console.log('   Firebase endpoint: firebase_restore_endpoint.js');
        console.log('   All 907 cameras ready for Firestore import');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

restoreAllCameras(); 