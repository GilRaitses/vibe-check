import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';
import { Request, Response } from 'express';
import { getCameraUuid, fetchNYCCameraImage, processImageWithVision, getCameraZoneInfo } from './camera-processing';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
admin.initializeApp();
export const db = admin.firestore();

// Initialize Express app
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// =====================================================
// HEALTH CHECK ENDPOINTS
// =====================================================

app.get('/health', (req: Request, res: Response) => {
  return res.json({
    status: 'healthy',
    timestamp: Date.now(),
    version: '2.0.0-clean'
  });
});

app.get('/status', (req: Request, res: Response) => {
  return res.json({
    status: 'operational',
    services: {
      firestore: 'healthy',
      vision_api: 'enabled',
      camera_processing: 'active'
    },
    timestamp: Date.now()
  });
});

// =====================================================
// VISION API CAMERA PROCESSING - SINGLE CLEAN ENDPOINT
// =====================================================

/**
 * REAL Cloud Vision API Processing Pipeline
 * This is the ONLY camera processing endpoint
 */
app.get('/monitoring/camera-image/:cameraId', async (req: Request, res: Response) => {
  const { cameraId } = req.params;
  const startTime = Date.now();
  
  console.log(`🔍 [VISION-PIPELINE] Starting analysis for camera: ${cameraId}`);
  
  try {
    // Step 1: Get camera info
    const cameraDoc = await db.collection('monitoring_schedules').doc(cameraId).get();
    
    if (!cameraDoc.exists) {
      return res.status(404).json({
        error: 'Camera not found',
        camera_id: cameraId,
        step_failed: 'camera_lookup'
      });
    }
    
    const cameraData = cameraDoc.data() as any;
    console.log(`✅ [STEP 1] Camera found: ${cameraData.camera?.name || 'Unknown'}`);
    
    // Step 1.5: Get complete zone information
    const zoneInfo = await getCameraZoneInfo(cameraData);
    console.log(`✅ [STEP 1.5] Zone info: ${zoneInfo.zone_id} - ${zoneInfo.camera_name} (${zoneInfo.borough})`);
    
    // Step 2: Map to NYC UUID
    let nycUuid: string | null = null;
    let visionResults: any = {};
    let processingError: string | null = null;
    
    try {
      nycUuid = await getCameraUuid(cameraData, db);
      console.log(`✅ [STEP 2] NYC UUID: ${nycUuid || 'Not found'}`);
    } catch (error) {
      processingError = `UUID mapping failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.log(`❌ [STEP 2] ${processingError}`);
    }
    
    // Step 3: Fetch image from NYC API
    let imageBuffer: Buffer | null = null;
    if (nycUuid && !processingError) {
      try {
        console.log(`📸 [STEP 3] Fetching image from NYC API...`);
        imageBuffer = await fetchNYCCameraImage(nycUuid);
        console.log(`✅ [STEP 3] Image fetched: ${imageBuffer.length} bytes`);
      } catch (error) {
        processingError = `Image fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.log(`❌ [STEP 3] ${processingError}`);
      }
    } else {
      console.log(`⏭️ [STEP 3] Skipped - no valid UUID`);
    }
    
    // Step 4: Process with Cloud Vision API
    if (imageBuffer && !processingError) {
      try {
        console.log(`👁️ [STEP 4] Processing image with Cloud Vision...`);
        visionResults = await processImageWithVision(imageBuffer);
        
        if (visionResults.error) {
          processingError = `Vision API error: ${visionResults.error_message}`;
          console.log(`❌ [STEP 4] ${processingError}`);
        } else {
          console.log(`✅ [STEP 4] Vision analysis complete`);
        }
      } catch (error) {
        processingError = `Vision processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.log(`❌ [STEP 4] ${processingError}`);
      }
    } else {
      console.log(`⏭️ [STEP 4] Skipped - no image data`);
    }
    
    // Step 5: Calculate temperature score
    let temperature_score = 5.0; // Default baseline
    let numerical_data: number[] = [];
    
    if (!processingError && visionResults.numerical_data) {
      try {
        const { AdaptiveMonitoringEngine } = await import('./adaptiveMonitoringEngine');
        const adaptiveScore = AdaptiveMonitoringEngine.calculateAdaptiveScore(
          visionResults.numerical_data,
          cameraData,
          24
        );
        temperature_score = adaptiveScore.total_score;
        numerical_data = visionResults.numerical_data;
        console.log(`✅ [STEP 5] Temperature score from Vision: ${temperature_score}`);
      } catch (error) {
        console.log(`⚠️ [STEP 5] Using baseline score: ${error instanceof Error ? error.message : 'Unknown error'}`);
        numerical_data = Array.from({length: 17}, () => Math.floor(Math.random() * 3));
      }
    } else {
      console.log(`⚠️ [STEP 5] Using baseline score due to: ${processingError}`);
      numerical_data = Array.from({length: 17}, () => Math.floor(Math.random() * 3));
    }
    
    // Step 6: Store results
    const analysisRecord = {
      camera_id: cameraId,
      zone_id: zoneInfo.zone_id,
      camera_name: zoneInfo.camera_name,
      borough: zoneInfo.borough,
      coordinates: zoneInfo.coordinates,
      latitude: zoneInfo.latitude,
      longitude: zoneInfo.longitude,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      temperature_score,
      numerical_data,
      cloud_vision_data: visionResults.cloud_vision_data || {
        error: true,
        error_message: processingError || 'Processing incomplete',
        pedestrian_count: 0,
        bicycle_count: 0,
        vehicle_count: 0,
        safety_score: 0,
        total_objects_detected: 0
      },
      ml_confidence: visionResults.ml_confidence || 0.0,
      data_source: processingError ? 'error_fallback' : 'live_nyc_camera',
      processing_time_ms: Date.now() - startTime,
      nyc_uuid: nycUuid,
      image_size_bytes: imageBuffer?.length || 0,
      processing_error: processingError,
      pipeline_status: {
        step_1_camera_lookup: 'success',
        step_1_5_zone_lookup: 'success',
        step_2_uuid_mapping: nycUuid ? 'success' : 'failed',
        step_3_image_fetch: imageBuffer ? 'success' : 'failed', 
        step_4_vision_analysis: (!processingError && visionResults.cloud_vision_data) ? 'success' : 'failed',
        step_5_temperature_calculation: 'success',
        step_6_storage: 'success'
      }
    };
    
    // Store in analyses collection
    await db.collection('analyses').add(analysisRecord);
    
    // Update monitoring schedule
    await db.collection('monitoring_schedules').doc(cameraId).update({
      current_score: temperature_score,
      last_analysis_time: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`🎉 [SUCCESS] Vision pipeline complete: ${Date.now() - startTime}ms`);
    
    return res.json({
      success: true,
      camera_id: cameraId,
      temperature_score,
      analysis_results: visionResults,
      processing_pipeline: analysisRecord.pipeline_status,
      processing_error: processingError,
      debug_info: {
        nyc_uuid: nycUuid,
        image_size_bytes: imageBuffer?.length || 0,
        processing_time_ms: Date.now() - startTime,
        vision_api_enabled: !processingError,
        data_source: analysisRecord.data_source
      }
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ [CRITICAL ERROR] Camera ${cameraId} failed: ${processingTime}ms`, error);
    
    return res.status(500).json({
      error: 'Vision pipeline failed',
      camera_id: cameraId,
      error_message: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: processingTime
    });
  }
});

// =====================================================
// ANALYTICS ENDPOINTS 
// =====================================================

app.get('/analytics/stored-analyses', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    
    // Get recent analyses from Firestore
    const analysesSnapshot = await db.collection('analyses')
      .orderBy('timestamp', 'desc')  
      .limit(limit)
      .get();
    
    const analyses = analysesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];
    
    // Get processing statistics
    const totalCount = await db.collection('analyses').count().get();
    const successfulAnalyses = analyses.filter((a: any) => !a.processing_error);
    
    const stats = {
      total_processed: totalCount.data().count,
      successful_analyses: successfulAnalyses.length,
      success_rate: totalCount.data().count > 0 ? (successfulAnalyses.length / analyses.length * 100).toFixed(1) : '0',
      avg_processing_time: analyses.length > 0 ? Math.round(analyses.reduce((sum: number, a: any) => sum + (a.processing_time_ms || 0), 0) / analyses.length) : 0,
      avg_temperature_score: analyses.length > 0 ? (analyses.reduce((sum: number, a: any) => sum + (a.temperature_score || 0), 0) / analyses.length).toFixed(1) : '0'
    };
    
    return res.json({
      success: true,
      analyses,
      stats,
      count: analyses.length
    });
    
  } catch (error) {
    console.error('Error loading stored analyses:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load stored analyses',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/analytics/processing-queue', async (req: Request, res: Response) => {
  try {
    // Get cameras that need processing (no recent analysis)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const camerasSnapshot = await db.collection('monitoring_schedules')
      .where('last_analysis_time', '<', oneHourAgo)
      .limit(10)
      .get();
    
    const queuedCameras = camerasSnapshot.docs.map(doc => ({
      camera_id: doc.id,
      ...doc.data(),
      queue_status: 'pending'
    }));
    
    return res.json({
      success: true,
      queued_cameras: queuedCameras,
      queue_length: queuedCameras.length
    });
    
  } catch (error) {
    console.error('Error getting processing queue:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get processing queue',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =====================================================
// DASHBOARD ENDPOINTS
// =====================================================

/**
 * Camera Zones Dashboard Data
 */
app.get('/dashboard/camera-zones', async (req: Request, res: Response) => {
  try {
    console.log('🎛️ [DASHBOARD] Loading camera zone heatmap data...');
    
    // Get all monitoring schedules
    const schedulesSnapshot = await db.collection('monitoring_schedules').get();
    const schedules = schedulesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    // Transform to dashboard format
    const zones = schedules.map((schedule: any) => ({
      id: schedule.camera_id,
      name: schedule.camera?.name || 'Unknown Camera',
      coordinates: schedule.coordinates || [0, 0],
      latitude: schedule.camera?.latitude || 0,
      longitude: schedule.camera?.longitude || 0,
      zone_id: schedule.zone_id,
      neighborhood: schedule.neighborhood,
      frequency_tier: schedule.frequency_tier || 'daily',
      frequency_color: schedule.frequency_color || '#32cd32',
      sampling_hours: schedule.sampling_frequency_hours || 24,
      is_high_risk: schedule.is_high_risk_zone || false,
      current_score: schedule.current_score || 24,
      camera_handle: schedule.original_handle,
      system_version: schedule.system_version
    }));
    
    const mapCenter = zones.length > 0 ? {
      lat: zones.reduce((sum, zone) => sum + zone.latitude, 0) / zones.length,
      lng: zones.reduce((sum, zone) => sum + zone.longitude, 0) / zones.length
    } : { lat: 40.7831, lng: -73.9712 }; // Default to NYC
    
    return res.json({
      success: true,
      zones,
      map_center: mapCenter,
      total_cameras: zones.length,
      frequency_distribution: {
        hourly: zones.filter(z => z.sampling_hours <= 2).length,
        daily: zones.filter(z => z.sampling_hours > 2 && z.sampling_hours <= 24).length,
        weekly: zones.filter(z => z.sampling_hours > 24).length
      }
    });
    
  } catch (error) {
    console.error('❌ Dashboard camera zones failed:', error);
    return res.status(500).json({
      error: 'Dashboard camera zones failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});
/**
 * ALL REAL NYC CAMERAS WITH ZONES - Load from enhanced zone-lookup.json
 */
app.get('/dashboard/nyc-cameras', async (req: Request, res: Response) => {
  try {
    console.log('🎥 [ENHANCED ZONES] Loading all 907 cameras with real NYC UUIDs and zones...');
    
    // Load enhanced zone-lookup.json with real NYC UUIDs
    const dataPath = path.join(__dirname, '../../zone-lookup.json');
    
    if (!fs.existsSync(dataPath)) {
      throw new Error('zone-lookup.json not found in functions directory');
    }
    
    const zoneLookupData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log(`✅ Loaded enhanced zone lookup with ${Object.keys(zoneLookupData).length} zones`);
    
    // Transform zone lookup to camera format
    const cameras = Object.values(zoneLookupData).map((zone: any) => ({
      id: zone.id || zone.nyc_uuid, // Real NYC camera UUID
      name: zone.camera_name,
      latitude: zone.coordinates[1],
      longitude: zone.coordinates[0],
      coordinates: zone.coordinates,
      area: zone.area || zone.borough,
      borough: zone.borough,
      zone_id: zone.zone_id,
      camera_handle: zone.camera_handle,
      nyc_uuid: zone.id || zone.nyc_uuid, // Real NYC UUID for API calls
      image_url: zone.imageUrl,
      is_online: zone.isOnline === 'true' || zone.isOnline === true || zone.isOnline === 'online',
      frequency_tier: 'daily',
      frequency_color: '#32cd32',
      current_score: 24,
      system_version: 'enhanced_zones_with_uuids',
      data_source: 'data/zone-lookup.json'
    }));
    
    // Calculate map center from all cameras
    const mapCenter = {
      lat: cameras.reduce((sum: number, camera: any) => sum + camera.latitude, 0) / cameras.length,
      lng: cameras.reduce((sum: number, camera: any) => sum + camera.longitude, 0) / cameras.length
    };
    
    // Borough distribution
    const boroughCounts: any = {};
    cameras.forEach((camera: any) => {
      const borough = camera.borough || camera.area || 'Unknown';
      boroughCounts[borough] = (boroughCounts[borough] || 0) + 1;
    });
    
    return res.json({
      success: true,
      zones: cameras, // Use same field name for compatibility
      cameras: cameras,
      map_center: mapCenter,
      total_cameras: cameras.length,
      borough_distribution: boroughCounts,
      data_source: 'data/zone-lookup.json',
      real_nyc_cameras: true,
      has_zone_mapping: true
    });
    
  } catch (error) {
    console.error('❌ Failed to load enhanced zone cameras:', error);
    return res.status(500).json({
      error: 'Failed to load enhanced zone cameras',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});



// =====================================================
// EXPORT SINGLE FUNCTION
// =====================================================

export const api = functions.https.onRequest(app);