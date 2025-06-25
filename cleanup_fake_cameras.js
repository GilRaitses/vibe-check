const fetch = require('node-fetch');

const API_BASE = 'https://us-central1-vibe-check-463816.cloudfunctions.net/api';

// List of fake cameras to remove
const FAKE_CAMERAS = [
    'cam_union_square_main',
    'cam_midtown_east_42nd',
    'cam_soho_houston', 
    'cam_hells_kitchen_001',
    'cam_hells_kitchen_8th_ave',
    'cam_amsterdam_001',
    'cam_union_square_001',
    'cam_chelsea_23rd'
];

async function cleanupFakeCameras() {
    console.log('🧹 [CLEANUP] Starting fake camera cleanup...');
    console.log(`🎭 [TARGET] Removing ${FAKE_CAMERAS.length} fake cameras:`);
    console.table(FAKE_CAMERAS);
    
    // First, let's check what the current processing queue looks like
    try {
        console.log('\n🔍 [CHECK] Current processing queue:');
        const queueResponse = await fetch(`${API_BASE}/analytics/processing-queue`);
        const queueData = await queueResponse.json();
        
        if (queueData.success) {
            console.log(`📊 Queue length: ${queueData.queued_cameras.length}`);
            queueData.queued_cameras.forEach((camera, index) => {
                const isFake = FAKE_CAMERAS.includes(camera.camera_id);
                console.log(`${index + 1}. ${camera.camera_id} ${isFake ? '🎭 (FAKE)' : '✅ (REAL)'}`);
            });
        }
    } catch (error) {
        console.error('❌ [ERROR] Failed to check queue:', error.message);
    }
    
    console.log('\n⚠️  [NOTICE] This script identifies fake cameras but cannot remove them directly.');
    console.log('📝 [SOLUTION] You need to manually remove them from Firebase Console or create a Firebase Function.');
    console.log('\n🔗 [FIREBASE CONSOLE] Go to: https://console.firebase.google.com/project/vibe-check-463816/firestore/data');
    console.log('📁 [COLLECTION] Navigate to: monitoring_schedules');
    console.log('🗑️  [ACTION] Delete the documents with these IDs:');
    
    FAKE_CAMERAS.forEach((cameraId, index) => {
        console.log(`   ${index + 1}. ${cameraId}`);
    });
    
    console.log('\n💡 [TIP] After deleting, refresh your processing tracker to see the clean results!');
}

cleanupFakeCameras().catch(console.error); 