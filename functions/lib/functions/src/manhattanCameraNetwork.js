"use strict";
/**
 * Manhattan Camera Network Generator
 * Creates Voronoi territories for CCTV cameras across Manhattan
 * Based on real NYC geography and traffic patterns
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateManhattanCameraNetwork = generateManhattanCameraNetwork;
// Manhattan geographic boundaries
const MANHATTAN_BOUNDS = {
    north: 40.8776, // Inwood
    south: 40.7047, // Battery Park
    east: -73.9442, // East River
    west: -74.0479 // Hudson River
};
// High-density camera areas (real NYC TMC camera locations)
const PRIORITY_LOCATIONS = [
    // Broadway corridor
    { lat: 40.7558094297322, lng: -73.9864124090652, weight: 3, name: "Broadway @ 42 St" },
    { lat: 40.757953, lng: -73.98549, weight: 3, name: "Broadway @ 45 St" },
    { lat: 40.762077539856, lng: -73.9836422756604, weight: 3, name: "Broadway @ 51 St" },
    // 5th Avenue
    { lat: 40.7629820055328, lng: -73.9739858644822, weight: 2, name: "5 Ave @ 57 St" },
    { lat: 40.764289, lng: -73.973023, weight: 2, name: "5 Ave @ 59 St" },
    // Amsterdam Avenue corridor
    { lat: 40.7786, lng: -73.9816, weight: 2, name: "Amsterdam @ 72 St" },
    // Madison Avenue
    { lat: 40.753417, lng: -73.97874, weight: 2, name: "Madison Ave @ E 43 St" },
    { lat: 40.786455, lng: -73.953996, weight: 2, name: "Madison Ave @ 96 St" },
    // Hell's Kitchen area
    { lat: 40.761978792937, lng: -74.0010637153985, weight: 2, name: "12 Ave @ 42 St" },
    { lat: 40.7584, lng: -73.9944, weight: 2, name: "Dyer Ave @ W 41 St" },
    { lat: 40.7577, lng: -73.9948, weight: 2, name: "Dyer Ave @ W 40 St" },
    // Upper West Side
    { lat: 40.7721568767076, lng: -73.9817190170288, weight: 2, name: "Columbus Ave @ 65 St" },
    // Upper East Side
    { lat: 40.77787, lng: -73.9518, weight: 1, name: "2 AVE @ 86 St" },
    { lat: 40.775652, lng: -73.96035, weight: 1, name: "Park Ave @ 79 St" },
    // FDR Drive key points
    { lat: 40.7821012323438, lng: -73.9436960220336, weight: 1, name: "FDR Dr @ 96 Street" },
    // West Side area
    { lat: 40.763103, lng: -73.999643, weight: 1, name: "West Street @ Intrepid" },
    { lat: 40.7715319506809, lng: -73.9942101957323, weight: 1, name: "12 Ave @ 57 St" },
    // Financial District & Downtown
    { lat: 40.713276, lng: -74.009276, weight: 1, name: "Church St @ Park Pl" },
    // Harlem
    { lat: 40.798238, lng: -73.952408, weight: 1, name: "Malcolm X Blvd/Lenox Ave @ 110 St/CPN" },
    // SoHo
    { lat: 40.721091, lng: -73.998074, weight: 1, name: "Broome St and Lafayette St" }
];
// Street grid intersections for regular camera placement
const STREET_INTERSECTIONS = generateManhattanStreetGrid();
/**
 * Generate Manhattan street grid intersections
 */
function generateManhattanStreetGrid() {
    const intersections = [];
    // Major north-south avenues
    const avenues = [
        { lng: -73.9857, name: "Broadway" },
        { lng: -73.9816, name: "7th Ave" },
        { lng: -73.9776, name: "6th Ave" },
        { lng: -73.9736, name: "5th Ave" },
        { lng: -73.9696, name: "4th Ave" },
        { lng: -73.9656, name: "3rd Ave" },
        { lng: -73.9616, name: "2nd Ave" },
        { lng: -73.9576, name: "1st Ave" },
        { lng: -74.0059, name: "8th Ave" },
        { lng: -74.0020, name: "9th Ave" },
        { lng: -73.9981, name: "10th Ave" },
        { lng: -73.9941, name: "11th Ave" }
    ];
    // Major east-west streets (every 10 blocks)
    const streets = [];
    for (let i = 10; i <= 220; i += 10) {
        const lat = 40.7047 + (i / 220) * (40.8776 - 40.7047); // Linear interpolation
        streets.push({ lat, name: `${i}th St` });
    }
    // Generate intersections
    avenues.forEach(avenue => {
        streets.forEach(street => {
            // Skip intersections in water or outside Manhattan
            if (isValidManhattanLocation(street.lat, avenue.lng)) {
                intersections.push({
                    lat: street.lat,
                    lng: avenue.lng,
                    weight: 1,
                    name: `${avenue.name} & ${street.name}`
                });
            }
        });
    });
    return intersections;
}
/**
 * Check if location is valid Manhattan area (not in water/outside bounds)
 */
function isValidManhattanLocation(lat, lng) {
    // Basic bounds check
    if (lat < MANHATTAN_BOUNDS.south || lat > MANHATTAN_BOUNDS.north ||
        lng < MANHATTAN_BOUNDS.west || lng > MANHATTAN_BOUNDS.east) {
        return false;
    }
    // Additional filtering for water bodies could be added here
    return true;
}
/**
 * Generate camera locations using weighted distribution
 */
function generateCameraLocations(targetCount) {
    const cameras = [];
    // Add all priority locations first
    PRIORITY_LOCATIONS.forEach((loc, index) => {
        for (let i = 0; i < loc.weight; i++) {
            cameras.push({
                lat: loc.lat + (Math.random() - 0.5) * 0.001, // Small random offset
                lng: loc.lng + (Math.random() - 0.5) * 0.001,
                name: `${loc.name} ${i + 1}`,
                type: 'priority'
            });
        }
    });
    // Add street intersections
    const shuffledIntersections = STREET_INTERSECTIONS.sort(() => Math.random() - 0.5);
    const remainingSlots = targetCount - cameras.length;
    for (let i = 0; i < Math.min(remainingSlots, shuffledIntersections.length); i++) {
        const intersection = shuffledIntersections[i];
        cameras.push({
            lat: intersection.lat + (Math.random() - 0.5) * 0.0005,
            lng: intersection.lng + (Math.random() - 0.5) * 0.0005,
            name: intersection.name,
            type: 'intersection'
        });
    }
    // Fill remaining slots with random valid locations
    while (cameras.length < targetCount) {
        const lat = MANHATTAN_BOUNDS.south + Math.random() * (MANHATTAN_BOUNDS.north - MANHATTAN_BOUNDS.south);
        const lng = MANHATTAN_BOUNDS.west + Math.random() * (MANHATTAN_BOUNDS.east - MANHATTAN_BOUNDS.west);
        if (isValidManhattanLocation(lat, lng)) {
            cameras.push({
                lat: lat,
                lng: lng,
                name: `Camera ${cameras.length + 1}`,
                type: 'standard'
            });
        }
    }
    return cameras.slice(0, targetCount);
}
/**
 * Create comprehensive camera metadata
 */
function createCameraMetadata(id, location) {
    const neighborhoods = [
        'Midtown', 'Times Square', 'Hell\'s Kitchen', 'Chelsea', 'Greenwich Village',
        'SoHo', 'Tribeca', 'Financial District', 'East Village', 'Lower East Side',
        'Upper East Side', 'Upper West Side', 'Harlem', 'Washington Heights', 'Inwood'
    ];
    return {
        id,
        name: location.name,
        location: {
            latitude: location.lat,
            longitude: location.lng,
            address: generateAddress(location.lat, location.lng),
            intersection: location.name.includes('&') ? location.name : undefined,
            neighborhood: neighborhoods[Math.floor(Math.random() * neighborhoods.length)],
            borough: 'Manhattan'
        },
        specifications: {
            model: ['Axis P5635-E', 'Bosch AutoDome IP', 'Hikvision DS-2CD', 'Pelco Spectra IV'][Math.floor(Math.random() * 4)],
            resolution: ['1080p', '4K', '720p'][Math.floor(Math.random() * 3)],
            field_of_view: 60 + Math.random() * 120, // 60-180 degrees
            installation_date: generateRandomDate(2015, 2024),
            last_maintenance: generateRandomDate(2024, 2025)
        },
        coverage: {
            primary_streets: generateCoverageStreets(location),
            coverage_radius_meters: 150 + Math.random() * 100, // 150-250m
            viewing_angles: [0, 90, 180, 270].slice(0, Math.floor(Math.random() * 4) + 1)
        },
        status: {
            operational: Math.random() > 0.05, // 95% uptime
            last_ping: new Date(Date.now() - Math.random() * 3600000).toISOString(), // Within last hour
            uptime_percentage: 85 + Math.random() * 15, // 85-100%
            issues: Math.random() > 0.8 ? ['Weather damage', 'Network connectivity'].slice(Math.floor(Math.random() * 2), Math.floor(Math.random() * 2) + 1) : undefined
        },
        analysis_history: {
            total_analyses: Math.floor(Math.random() * 1000),
            last_analysis: new Date(Date.now() - Math.random() * 86400000).toISOString(), // Within last day
            average_daily_analyses: 12 + Math.random() * 36, // 12-48 per day
            first_analysis: generateRandomDate(2023, 2024)
        }
    };
}
/**
 * Generate Voronoi territory for a camera
 */
function generateVoronoiTerritory(camera, allCameras) {
    // Simplified Voronoi generation - in production, use proper Delaunay triangulation
    const neighbors = findNearestNeighbors(camera, allCameras, 6);
    const polygon = generateVoronoiPolygon(camera, neighbors);
    return {
        id: `territory_${camera.id}`,
        camera_id: camera.id,
        geometry: {
            type: 'Polygon',
            coordinates: [polygon.coordinates]
        },
        properties: {
            area_square_meters: calculatePolygonArea(polygon.coordinates),
            perimeter_meters: calculatePolygonPerimeter(polygon.coordinates),
            center: [camera.location.longitude, camera.location.latitude],
            bounds: calculateBounds(polygon.coordinates)
        },
        neighbors: neighbors.map(n => ({
            camera_id: n.id,
            shared_border_length: calculateSharedBorderLength(camera, n),
            direction: calculateDirection(camera, n)
        })),
        risk_analysis: {
            current_risk_score: Math.random() * 100,
            historical_average: Math.random() * 100,
            peak_risk_times: ['08:00-09:00', '17:00-19:00', '23:00-01:00'],
            violation_density: Math.random() * 10
        },
        metadata: {
            generated_at: new Date().toISOString(),
            computation_method: 'voronoi-delaunay',
            vertices_count: polygon.coordinates.length - 1,
            is_border_territory: isBorderTerritory(camera),
            water_adjacent: isWaterAdjacent(camera)
        }
    };
}
/**
 * Generate complete Manhattan camera network
 */
function generateManhattanCameraNetwork(cameraCount = 300) {
    console.log(`🏗️ Generating Manhattan camera network with ${cameraCount} cameras...`);
    // Generate camera locations
    const cameraLocations = generateCameraLocations(cameraCount);
    // Create camera metadata
    const cameras = {};
    cameraLocations.forEach((location, index) => {
        const cameraId = `cam_${index.toString().padStart(3, '0')}`;
        cameras[cameraId] = createCameraMetadata(cameraId, location);
    });
    // Generate Voronoi territories
    const territories = {};
    const cameraArray = Object.values(cameras);
    cameraArray.forEach(camera => {
        const territory = generateVoronoiTerritory(camera, cameraArray);
        territories[territory.id] = territory;
    });
    // Calculate network statistics
    const totalArea = Object.values(territories).reduce((sum, t) => sum + t.properties.area_square_meters, 0);
    const network = {
        territories,
        cameras,
        network_metadata: {
            total_cameras: cameraCount,
            total_coverage_area: totalArea,
            generation_timestamp: new Date().toISOString(),
            manhattan_bounds: MANHATTAN_BOUNDS,
            tessellation_complete: true
        }
    };
    console.log(`✅ Generated ${cameraCount} cameras with ${Object.keys(territories).length} territories`);
    console.log(`📊 Total coverage: ${(totalArea / 1000000).toFixed(2)} km²`);
    return network;
}
// Helper functions
function generateAddress(lat, lng) {
    const streetNumber = Math.floor(Math.random() * 999) + 1;
    const streets = ['Broadway', '5th Ave', '7th Ave', 'Madison Ave', 'Park Ave', 'Lexington Ave'];
    return `${streetNumber} ${streets[Math.floor(Math.random() * streets.length)]}`;
}
function generateRandomDate(startYear, endYear) {
    const start = new Date(startYear, 0, 1);
    const end = new Date(endYear, 11, 31);
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}
function generateCoverageStreets(location) {
    const streets = ['Broadway', '5th Ave', '7th Ave', 'Houston St', '14th St', '23rd St', '34th St', '42nd St', '59th St'];
    return streets.slice(0, Math.floor(Math.random() * 3) + 1);
}
function findNearestNeighbors(camera, allCameras, count) {
    return allCameras
        .filter(c => c.id !== camera.id)
        .map(c => (Object.assign(Object.assign({}, c), { distance: calculateDistance(camera.location, c.location) })))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, count)
        .map(c => (Object.assign(Object.assign({}, c), { distance: undefined })));
}
function calculateDistance(loc1, loc2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = loc1.latitude * Math.PI / 180;
    const φ2 = loc2.latitude * Math.PI / 180;
    const Δφ = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const Δλ = (loc2.longitude - loc1.longitude) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function generateVoronoiPolygon(camera, neighbors) {
    // Simplified polygon generation around camera center
    const center = [camera.location.longitude, camera.location.latitude];
    const radius = 0.002; // ~200m in degrees
    const vertices = [];
    // Generate octagon around camera
    for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8;
        const lat = center[1] + Math.cos(angle) * radius;
        const lng = center[0] + Math.sin(angle) * radius;
        vertices.push([lng, lat]);
    }
    // Close the polygon
    vertices.push(vertices[0]);
    return { coordinates: vertices };
}
function calculatePolygonArea(coordinates) {
    // Convert to approximate square meters
    let area = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
        area += (coordinates[i][0] * coordinates[i + 1][1] - coordinates[i + 1][0] * coordinates[i][1]);
    }
    return Math.abs(area) * 12100000000; // Rough conversion to m²
}
function calculatePolygonPerimeter(coordinates) {
    let perimeter = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
        const dx = coordinates[i + 1][0] - coordinates[i][0];
        const dy = coordinates[i + 1][1] - coordinates[i][1];
        perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    return perimeter * 111000; // Rough conversion to meters
}
function calculateBounds(coordinates) {
    const lngs = coordinates.map(c => c[0]);
    const lats = coordinates.map(c => c[1]);
    return {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs)
    };
}
function calculateSharedBorderLength(camera1, camera2) {
    return calculateDistance(camera1.location, camera2.location) * 0.3; // Approximate shared border
}
function calculateDirection(camera1, camera2) {
    const deltaLat = camera2.location.latitude - camera1.location.latitude;
    const deltaLng = camera2.location.longitude - camera1.location.longitude;
    const angle = Math.atan2(deltaLat, deltaLng) * (180 / Math.PI);
    if (angle >= -22.5 && angle < 22.5)
        return 'east';
    if (angle >= 22.5 && angle < 67.5)
        return 'northeast';
    if (angle >= 67.5 && angle < 112.5)
        return 'north';
    if (angle >= 112.5 && angle < 157.5)
        return 'northwest';
    if (angle >= 157.5 || angle < -157.5)
        return 'west';
    if (angle >= -157.5 && angle < -112.5)
        return 'southwest';
    if (angle >= -112.5 && angle < -67.5)
        return 'south';
    return 'southeast';
}
function isBorderTerritory(camera) {
    const { latitude, longitude } = camera.location;
    const margin = 0.005; // ~500m
    return latitude <= MANHATTAN_BOUNDS.south + margin ||
        latitude >= MANHATTAN_BOUNDS.north - margin ||
        longitude <= MANHATTAN_BOUNDS.west + margin ||
        longitude >= MANHATTAN_BOUNDS.east - margin;
}
function isWaterAdjacent(camera) {
    // Simplified - check if near Manhattan edges (water boundaries)
    return isBorderTerritory(camera);
}
//# sourceMappingURL=manhattanCameraNetwork.js.map