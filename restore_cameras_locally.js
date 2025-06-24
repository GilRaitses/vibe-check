#!/usr/bin/env node

const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin using default credentials (Firebase CLI)
admin.initializeApp({
  projectId: 'vibe-check-463816'
});

const db = admin.firestore();

async function restoreAllCameras() {
  try {
    console.log('🚀 Starting LOCAL bulk camera restoration...');
    
    // Load the complete restoration data we prepared
    let allSchedules;
    try {
      const completeData = fs.readFileSync('monitoring_schedules_complete.json', 'utf8');
      allSchedules = JSON.parse(completeData);
    } catch (error) {
      console.error('❌ Could not load monitoring_schedules_complete.json:', error);
      return;
    }
    
    console.log(`📂 Loaded ${allSchedules.length} cameras from complete restoration data`);
    
    // Count by borough
    const boroughStats = {};
    allSchedules.forEach(schedule => {
      boroughStats[schedule.neighborhood] = (boroughStats[schedule.neighborhood] || 0) + 1;
    });
    
    console.log('🏙️ Borough distribution:', boroughStats);
    
    // Batch write to Firestore (500 docs max per batch)
    const batchSize = 500;
    let totalRestored = 0;
    const errors = [];
    
    for (let i = 0; i < allSchedules.length; i += batchSize) {
      try {
        const batch = db.batch();
        const currentBatch = allSchedules.slice(i, i + batchSize);
        
        currentBatch.forEach(schedule => {
          // Add server timestamps
          const scheduleWithTimestamps = {
            ...schedule,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            last_updated: admin.firestore.FieldValue.serverTimestamp(),
            next_analysis_time: admin.firestore.Timestamp.fromDate(
              new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
            )
          };
          
          const docRef = db.collection('monitoring_schedules').doc(schedule.camera_id);
          batch.set(docRef, scheduleWithTimestamps, { merge: true });
        });
        
        await batch.commit();
        totalRestored += currentBatch.length;
        console.log(`✅ Restored batch ${Math.floor(i/batchSize) + 1}: ${totalRestored}/${allSchedules.length} cameras`);
        
      } catch (error) {
        console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, error);
        errors.push({
          batch: Math.floor(i/batchSize) + 1,
          error: error.message
        });
      }
    }
    
    console.log(`🎉 LOCAL CAMERA RESTORATION COMPLETED!`);
    console.log(`   Total restored: ${totalRestored}/${allSchedules.length}`);
    console.log(`   Success rate: ${((totalRestored/allSchedules.length)*100).toFixed(1)}%`);
    console.log(`   Borough stats:`, boroughStats);
    
    if (errors.length > 0) {
      console.log(`❌ Errors:`, errors);
    }
    
    // Verify by checking total documents
    const snapshot = await db.collection('monitoring_schedules').get();
    console.log(`🔍 Verification: ${snapshot.size} total cameras in monitoring_schedules collection`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Local camera restoration failed:', error);
    process.exit(1);
  }
}

restoreAllCameras(); 