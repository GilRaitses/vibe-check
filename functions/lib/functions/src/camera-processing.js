"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCameraUuid = getCameraUuid;
exports.getCameraZoneInfo = getCameraZoneInfo;
exports.fetchNYCCameraImage = fetchNYCCameraImage;
exports.processImageWithVision = processImageWithVision;
const node_fetch_1 = require("node-fetch");
const vision_1 = require("@google-cloud/vision");
// Initialize Vision API client with proper typing
let visionClient;
try {
    visionClient = new vision_1.ImageAnnotatorClient();
}
catch (error) {
    console.error('Failed to initialize Vision API client:', error);
}
/**
 * Map camera handle to NYC Traffic Camera UUID and get zone information
 * Uses the zone-lookup.json data to find the actual NYC UUID and zone mapping
 */
async function getCameraUuid(cameraData, db) {
    var _a, _b;
    try {
        // Check if UUID is already stored in the camera data
        if (cameraData.nyc_uuid) {
            return cameraData.nyc_uuid;
        }
        // Load zone lookup data to map camera to NYC UUID
        const fs = require('fs');
        const path = require('path');
        try {
            const zoneLookupPath = path.join(__dirname, '../../data/zone-lookup.json');
            if (fs.existsSync(zoneLookupPath)) {
                const zoneData = JSON.parse(fs.readFileSync(zoneLookupPath, 'utf8'));
                // Try to find the camera in zone lookup by camera_id or handle
                const cameraId = cameraData.camera_id || ((_a = cameraData.camera) === null || _a === void 0 ? void 0 : _a.id);
                const cameraHandle = (_b = cameraData.camera) === null || _b === void 0 ? void 0 : _b.handle;
                // Search through zone data
                for (const zoneKey in zoneData) {
                    const zone = zoneData[zoneKey];
                    if (zone.camera_handle === cameraId ||
                        zone.camera_handle === cameraHandle ||
                        zone.zone_id === cameraData.zone_id) {
                        console.log(`Found zone mapping: ${cameraId} -> NYC UUID: ${zone.nyc_uuid || zone.camera_uuid}`);
                        return zone.nyc_uuid || zone.camera_uuid || '9bd74b87-32d1-4767-8081-86a2e83f28f2';
                    }
                }
                console.log(`No zone mapping found for camera: ${cameraId}`);
            }
        }
        catch (error) {
            console.error('Error loading zone lookup data:', error);
        }
        // Fallback to hardcoded UUID for testing
        return '9bd74b87-32d1-4767-8081-86a2e83f28f2';
    }
    catch (error) {
        console.error('Error mapping camera UUID:', error);
        return null;
    }
}
/**
 * Get complete zone information for a camera
 * Returns zone details including location, borough, etc.
 */
async function getCameraZoneInfo(cameraData) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
        const fs = require('fs');
        const path = require('path');
        const zoneLookupPath = path.join(__dirname, '../../data/zone-lookup.json');
        if (fs.existsSync(zoneLookupPath)) {
            const zoneData = JSON.parse(fs.readFileSync(zoneLookupPath, 'utf8'));
            // Try to find the camera in zone lookup
            const cameraId = cameraData.camera_id || ((_a = cameraData.camera) === null || _a === void 0 ? void 0 : _a.id);
            for (const zoneKey in zoneData) {
                const zone = zoneData[zoneKey];
                if (zone.camera_handle === cameraId || zone.zone_id === cameraData.zone_id) {
                    return {
                        zone_id: zone.zone_id,
                        handle: zone.handle,
                        camera_name: zone.camera_name,
                        borough: zone.borough,
                        coordinates: zone.coordinates,
                        latitude: zone.coordinates[1],
                        longitude: zone.coordinates[0],
                        nyc_uuid: zone.nyc_uuid || zone.camera_uuid
                    };
                }
            }
        }
        // Return basic info if no zone mapping found
        return {
            zone_id: cameraData.zone_id || 'Unknown',
            handle: ((_b = cameraData.camera) === null || _b === void 0 ? void 0 : _b.handle) || 'Unknown',
            camera_name: ((_c = cameraData.camera) === null || _c === void 0 ? void 0 : _c.name) || 'Unknown Camera',
            borough: ((_d = cameraData.camera) === null || _d === void 0 ? void 0 : _d.area) || 'Unknown',
            coordinates: [((_e = cameraData.camera) === null || _e === void 0 ? void 0 : _e.longitude) || 0, ((_f = cameraData.camera) === null || _f === void 0 ? void 0 : _f.latitude) || 0],
            latitude: ((_g = cameraData.camera) === null || _g === void 0 ? void 0 : _g.latitude) || 0,
            longitude: ((_h = cameraData.camera) === null || _h === void 0 ? void 0 : _h.longitude) || 0
        };
    }
    catch (error) {
        console.error('Error getting zone info:', error);
        return {
            zone_id: 'Error',
            handle: 'Error',
            camera_name: 'Error loading zone data',
            borough: 'Unknown',
            coordinates: [0, 0],
            latitude: 0,
            longitude: 0
        };
    }
}
/**
 * Fetch camera image from NYC Traffic Camera API
 * Uses the actual NYC endpoint: https://webcams.nyctmc.org/api/cameras/{uuid}/image
 */
async function fetchNYCCameraImage(uuid) {
    try {
        const imageUrl = `https://webcams.nyctmc.org/api/cameras/${uuid}/image`;
        console.log(`Fetching image from NYC API: ${imageUrl}`);
        const response = await (0, node_fetch_1.default)(imageUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Vibecheck-NYC/1.0'
            },
            timeout: 10000 // 10 second timeout
        });
        if (!response.ok) {
            throw new Error(`NYC API responded with status: ${response.status} ${response.statusText}`);
        }
        const contentType = response.headers.get('content-type');
        if (!(contentType === null || contentType === void 0 ? void 0 : contentType.startsWith('image/'))) {
            throw new Error(`Expected image content, got: ${contentType}`);
        }
        const imageBuffer = await response.buffer();
        console.log(`Successfully fetched ${imageBuffer.length} bytes from NYC camera ${uuid}`);
        return imageBuffer;
    }
    catch (error) {
        console.error(`Failed to fetch image from NYC API for UUID ${uuid}:`, error);
        throw error;
    }
}
/**
 * Process image with Google Cloud Vision API
 * Real implementation using the Vision API to extract meaningful data
 */
async function processImageWithVision(imageBuffer) {
    var _a, _b, _c, _d;
    try {
        console.log('🔍 Starting Cloud Vision API processing...');
        // Try to use Vision API with proper error handling
        let objects = [];
        let labels = [];
        try {
            // Use the correct annotateImage method with features
            const request = {
                image: { content: imageBuffer },
                features: [
                    { type: 'OBJECT_LOCALIZATION', maxResults: 50 },
                    { type: 'LABEL_DETECTION', maxResults: 50 }
                ]
            };
            const [result] = await visionClient.annotateImage(request);
            // Extract objects and labels from the response
            objects = result.localizedObjectAnnotations || [];
            labels = result.labelAnnotations || [];
        }
        catch (visionError) {
            console.error('Vision API calls failed:', visionError);
            // Check if it's an API not enabled error
            if (((_a = visionError.message) === null || _a === void 0 ? void 0 : _a.includes('API has not been used')) ||
                ((_b = visionError.message) === null || _b === void 0 ? void 0 : _b.includes('not enabled')) ||
                visionError.code === 403) {
                return {
                    error: true,
                    error_type: 'VISION_API_NOT_ENABLED',
                    error_message: 'Cloud Vision API is not enabled for this project',
                    instruction: 'Enable Cloud Vision API in Google Cloud Console: https://console.cloud.google.com/apis/library/vision.googleapis.com',
                    timestamp: new Date().toISOString()
                };
            }
            // Check if it's an authentication error
            if (((_c = visionError.message) === null || _c === void 0 ? void 0 : _c.includes('authentication')) ||
                ((_d = visionError.message) === null || _d === void 0 ? void 0 : _d.includes('credentials')) ||
                visionError.code === 401) {
                return {
                    error: true,
                    error_type: 'VISION_API_AUTH_ERROR',
                    error_message: 'Authentication failed for Cloud Vision API',
                    instruction: 'Check service account credentials and permissions',
                    timestamp: new Date().toISOString()
                };
            }
            // Generic Vision API error
            return {
                error: true,
                error_type: 'VISION_API_ERROR',
                error_message: visionError.message || 'Unknown Vision API error',
                timestamp: new Date().toISOString()
            };
        }
        console.log(`📊 Vision API detected ${objects.length} objects and ${labels.length} labels`);
        // Count relevant objects for urban sensing
        const objectCounts = {
            pedestrian_count: objects.filter(obj => { var _a; return (_a = obj.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('person'); }).length,
            bicycle_count: objects.filter(obj => { var _a; return (_a = obj.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('bicycle'); }).length,
            vehicle_count: objects.filter(obj => {
                var _a, _b, _c;
                return ((_a = obj.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('car')) ||
                    ((_b = obj.name) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes('truck')) ||
                    ((_c = obj.name) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes('vehicle'));
            }).length,
            total_objects_detected: objects.length
        };
        // Extract infrastructure elements
        const infrastructure = {
            sidewalk_visible: labels.some(label => { var _a; return (_a = label.description) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('sidewalk'); }),
            bike_lane_visible: labels.some(label => { var _a; return (_a = label.description) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('bike'); }),
            crosswalk_visible: labels.some(label => { var _a; return (_a = label.description) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('crosswalk'); }),
            traffic_signals_visible: labels.some(label => {
                var _a, _b;
                return ((_a = label.description) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('traffic')) &&
                    ((_b = label.description) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes('light'));
            }),
            street_lighting: labels.some(label => { var _a; return (_a = label.description) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('street light'); })
        };
        // Calculate safety score based on detected elements
        const safetyScore = calculateSafetyScore(objectCounts, infrastructure, labels);
        // Generate numerical data array for temperature calculation
        const numerical_data = [
            Math.min(objectCounts.pedestrian_count, 5), // pedestrian violations (capped)
            Math.min(objectCounts.bicycle_count, 3), // bike violations (capped)
            0, // red light violations (requires more complex detection)
            Math.min(objectCounts.pedestrian_count + objectCounts.bicycle_count, 8), // interaction score
            infrastructure.sidewalk_visible ? 0 : 2, // sidewalk obstruction
            infrastructure.bike_lane_visible ? 1 : 0, // bike lane position
            Math.min(objectCounts.vehicle_count, 5), // traffic congestion
            Math.min(objectCounts.pedestrian_count * 0.5, 3), // pedestrian impact
            objectCounts.pedestrian_count, // pedestrian density
            objectCounts.bicycle_count, // bike volume
            Math.min(Object.values(infrastructure).filter(Boolean).length, 4), // intersection complexity
            infrastructure.sidewalk_visible && infrastructure.traffic_signals_visible ? 2 : 1, // infrastructure score
            new Date().getHours() > 16 || new Date().getHours() < 9 ? 2 : 1, // temporal pattern
            1, // weather impact (would need weather API)
            0, // event correlation (would need event data)
            Math.max(5 - safetyScore, 0), // safety baseline
            objectCounts.total_objects_detected // total activity
        ];
        // Calculate overall confidence
        const avgConfidence = objects.reduce((sum, obj) => sum + (obj.score || 0), 0) / Math.max(objects.length, 1);
        const result = {
            numerical_data,
            cloud_vision_data: Object.assign(Object.assign({}, objectCounts), { safety_score: safetyScore, infrastructure, detected_objects: objects.map(obj => ({
                    name: obj.name,
                    confidence: obj.score,
                    bounding_box: obj.boundingPoly
                })), detected_labels: labels.map(label => ({
                    description: label.description,
                    score: label.score,
                    confidence: label.confidence
                })), total_labels_detected: labels.length }),
            ml_confidence: avgConfidence,
            processing_timestamp: new Date().toISOString(),
            api_response_time_ms: Date.now() // Would track actual response time
        };
        console.log('✅ Cloud Vision processing completed successfully');
        return result;
    }
    catch (error) {
        console.error('❌ Cloud Vision processing failed:', error);
        // Return error information instead of throwing
        return {
            error: true,
            error_message: error instanceof Error ? error.message : 'Unknown error',
            error_type: 'VISION_API_ERROR',
            timestamp: new Date().toISOString(),
            fallback_note: 'Vision API failed - check API key and permissions'
        };
    }
}
/**
 * Calculate safety score based on detected elements
 */
function calculateSafetyScore(objectCounts, infrastructure, labels) {
    let score = 5; // Base safety score
    // Reduce score for high pedestrian/vehicle density
    if (objectCounts.pedestrian_count > 5)
        score -= 1;
    if (objectCounts.vehicle_count > 8)
        score -= 1;
    // Improve score for good infrastructure
    if (infrastructure.sidewalk_visible)
        score += 0.5;
    if (infrastructure.traffic_signals_visible)
        score += 0.5;
    if (infrastructure.crosswalk_visible)
        score += 0.5;
    // Check for safety-related labels
    const dangerLabels = labels.filter(label => {
        var _a, _b, _c;
        return ((_a = label.description) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('construction')) ||
            ((_b = label.description) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes('crowd')) ||
            ((_c = label.description) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes('congestion'));
    });
    score -= dangerLabels.length * 0.3;
    return Math.max(0, Math.min(10, score));
}
//# sourceMappingURL=camera-processing.js.map