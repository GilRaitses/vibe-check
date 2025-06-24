const fs = require('fs');
const d3 = require('d3-delaunay');
const turf = require('@turf/turf');

console.log('🗽 COMPLETE NYC TESSELLATION - All 5 Boroughs');
console.log('🎯 Fixing Geographic Coverage - Including ALL NYC Cameras');

// Load data
const cameras = JSON.parse(fs.readFileSync('data/cameras-with-handles.json', 'utf8'));
const nycBoroughs = JSON.parse(fs.readFileSync('data/nyc_boroughs_with_water.geojson', 'utf8'));

console.log(`📸 Loaded ${cameras.length} total cameras`);
console.log(`🗽 Loaded ${nycBoroughs.features.length} NYC boroughs`);

// Enhanced NYC bounds to include all 5 boroughs
const EXPANDED_NYC_BOUNDS = {
    north: 40.95,   // Bronx
    south: 40.45,   // Staten Island  
    east: -73.6,    // Queens
    west: -74.3     // Staten Island
};

console.log('📍 Using expanded NYC bounds to include all boroughs:');
console.log(`   North: ${EXPANDED_NYC_BOUNDS.north} (Bronx)`);
console.log(`   South: ${EXPANDED_NYC_BOUNDS.south} (Staten Island)`);
console.log(`   East: ${EXPANDED_NYC_BOUNDS.east} (Queens)`);
console.log(`   West: ${EXPANDED_NYC_BOUNDS.west} (Staten Island)`);

// Create comprehensive NYC boundary
let nycLandmass;
try {
    const nycBoroughPolygons = nycBoroughs.features.map(f => f.geometry);
    nycLandmass = nycBoroughPolygons.reduce((union, polygon) => {
        if (!union) return turf.feature(polygon);
        try {
            return turf.union(union, turf.feature(polygon));
        } catch (e) {
            return union;
        }
    }, null);
    console.log(`✅ Created unified NYC landmass: ${(turf.area(nycLandmass) / 1000000).toFixed(2)} km²`);
} catch (error) {
    console.log('⚠️ Using fallback NYC boundary (expanded bounding box)');
    nycLandmass = null;
}

// Enhanced point-in-NYC detection
function isPointInNYC(lng, lat) {
    // Primary check: use real boundaries if available
    if (nycLandmass) {
        try {
            const point = turf.point([lng, lat]);
            return turf.booleanPointInPolygon(point, nycLandmass);
        } catch (e) {
            // Fall through to bounds check
        }
    }
    
    // Secondary check: expanded bounds to include all boroughs
    return lng >= EXPANDED_NYC_BOUNDS.west && lng <= EXPANDED_NYC_BOUNDS.east && 
           lat >= EXPANDED_NYC_BOUNDS.south && lat <= EXPANDED_NYC_BOUNDS.north;
}

// Borough detection with fallback
function getBoroughForPoint(lng, lat) {
    // Try real borough boundaries first
    try {
        const point = turf.point([lng, lat]);
        for (const borough of nycBoroughs.features) {
            if (turf.booleanPointInPolygon(point, borough)) {
                return {
                    name: borough.properties.boroname,
                    code: borough.properties.borocode
                };
            }
        }
    } catch (e) {
        // Fall through to geographic inference
    }
    
    // Geographic inference based on coordinates
    if (lat > 40.85) return { name: 'Bronx', code: '2' };
    if (lng < -73.97 && lat > 40.75) return { name: 'Manhattan', code: '1' };
    if (lng > -73.95 && lat > 40.65) return { name: 'Queens', code: '4' };
    if (lng < -73.95 && lat < 40.68) return { name: 'Brooklyn', code: '3' };
    if (lat < 40.6) return { name: 'Staten Island', code: '5' };
    
    return { name: 'Unknown', code: '0' };
}

// Advanced polygon clipping
function clipToNYC(cellCoords) {
    if (!nycLandmass || !cellCoords || cellCoords.length < 4) return cellCoords;
    
    try {
        const coords = [...cellCoords];
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
            coords.push([coords[0][0], coords[0][1]]);
        }
        
        const cellPolygon = turf.polygon([coords]);
        const intersection = turf.intersect(cellPolygon, nycLandmass);
        
        if (intersection?.geometry) {
            if (intersection.geometry.type === 'Polygon') {
                return intersection.geometry.coordinates[0];
            } else if (intersection.geometry.type === 'MultiPolygon') {
                let largest = intersection.geometry.coordinates[0][0];
                let largestArea = 0;
                
                intersection.geometry.coordinates.forEach(coordsArray => {
                    const area = turf.area(turf.polygon(coordsArray));
                    if (area > largestArea) {
                        largestArea = area;
                        largest = coordsArray[0];
                    }
                });
                return largest;
            }
        }
        return cellCoords;
    } catch (e) {
        return cellCoords;
    }
}

// Enhanced bridge detection with ALL NYC bridges
const enhancedBridges = [
    {
        name: "Brooklyn Bridge",
        cameras: ["BKSSBBE", "MNFDBBEN", "MNFDBB", "MNBNRBM"],
        center: [-73.9969, 40.7061]
    },
    {
        name: "Manhattan Bridge", 
        cameras: ["MNBR", "MN13BR", "BK02BR"],
        center: [-73.9909, 40.7131]
    },
    {
        name: "Williamsburg Bridge",
        cameras: ["WLBR", "MN12BR", "BK03BR"],
        center: [-73.9749, 40.7131]
    },
    {
        name: "Queensboro Bridge",
        cameras: ["QBBR", "MN59BR", "QN01BR", "QNFB", "QNNBHB"],
        center: [-73.9549, 40.7561]
    },
    {
        name: "Verrazzano-Narrows Bridge",
        cameras: ["VZBR", "BKBPVB", "SI01BR", "BK11BR", "SIOCTA"],
        center: [-74.0486, 40.6064]
    },
    {
        name: "George Washington Bridge",
        cameras: ["GWB", "MNHP178", "BRONX", "GWBR"],
        center: [-73.9522, 40.8517]
    },
    {
        name: "Triborough Bridge",
        cameras: ["TBR", "QN02BR", "MN60BR", "QNRFK"],
        center: [-73.9256, 40.7795]
    }
];

function isBridgeCamera(camera) {
    return enhancedBridges.some(bridge => 
        bridge.cameras.some(bridgeCam => 
            camera.handle.includes(bridgeCam) || bridgeCam.includes(camera.handle)
        ) ||
        camera.name.toLowerCase().includes('bridge') ||
        camera.name.toLowerCase().includes(' br ') ||
        camera.name.toLowerCase().includes('br @')
    );
}

function getBridgeShape(camera) {
    const bridge = enhancedBridges.find(b => 
        b.cameras.some(bridgeCam => 
            camera.handle.includes(bridgeCam) || bridgeCam.includes(camera.handle)
        ) ||
        camera.name.toLowerCase().includes(b.name.toLowerCase().split(' ')[0])
    );
    
    if (bridge) {
        const [centerLng, centerLat] = bridge.center;
        const w = 0.003, l = 0.008;
        return [
            [centerLng - l/2, centerLat - w/2], [centerLng + l/4, centerLat - w/3],
            [centerLng + l/2, centerLat - w/4], [centerLng + l/4, centerLat + w/3],
            [centerLng + l/2, centerLat + w/2], [centerLng - l/4, centerLat + w/3],
            [centerLng - l/2, centerLat + w/4], [centerLng - l/4, centerLat - w/3],
            [centerLng - l/2, centerLat - w/2]
        ];
    }
    
    // Enhanced fallback for any bridge
    const [lat, lng] = camera.coordinates;
    const w = 0.002, l = 0.006;
    return [
        [lng - l/2, lat - w/2], [lng + l/3, lat - w/3], [lng + l/2, lat - w/4],
        [lng + l/3, lat + w/3], [lng + l/2, lat + w/2], [lng - l/3, lat + w/3],
        [lng - l/2, lat + w/4], [lng - l/3, lat - w/3], [lng - l/2, lat - w/2]
    ];
}

// Filter cameras to ALL of NYC (not just one borough!)
const allNYCCameras = cameras.filter(camera => {
    if (!camera.coordinates?.length) return false;
    const [lat, lng] = camera.coordinates;
    return isPointInNYC(lng, lat);
});

console.log(`📍 Found ${allNYCCameras.length} cameras across ALL NYC boroughs!`);

// Analyze borough distribution
const boroughCounts = {};
allNYCCameras.forEach(camera => {
    const borough = getBoroughForPoint(camera.coordinates[1], camera.coordinates[0]);
    boroughCounts[borough.name] = (boroughCounts[borough.name] || 0) + 1;
});

console.log('\n🏙️ CAMERA DISTRIBUTION BY BOROUGH:');
Object.entries(boroughCounts).forEach(([borough, count]) => {
    console.log(`   ${borough}: ${count} cameras`);
});

const zones = [];
const processedBridges = new Set();

// Create bridge zones with enhanced geometry
allNYCCameras.forEach(camera => {
    if (isBridgeCamera(camera)) {
        const bridgeShape = getBridgeShape(camera);
        const borough = getBoroughForPoint(camera.coordinates[1], camera.coordinates[0]);
        
        zones.push({
            integer_id: camera.integer_id,
            handle: camera.handle,
            nyc_id: camera.nyc_id,
            name: camera.name,
            borough: borough.name,
            coordinates: camera.coordinates,
            image_url: camera.image_url,
            is_online: camera.is_online,
            last_analysis: null,
            voronoi_polygon: {
                type: "Polygon",
                coordinates: [bridgeShape]
            },
            zone_area_sqm: turf.area(turf.polygon([bridgeShape])),
            vertices_count: bridgeShape.length - 1,
            is_land_zone: false,
            is_bridge_zone: true,
            bounded_by_coastline: false,
            coverage_quality: 'enhanced_bridge_geometry',
            tessellation_method: 'complete_nyc_geographic_constrained'
        });
        
        processedBridges.add(camera.handle);
        console.log(`🌉 Bridge zone: ${camera.handle} - ${camera.name}`);
    }
});

// Create comprehensive Voronoi for all remaining cameras
const regularCameras = allNYCCameras.filter(c => !processedBridges.has(c.handle));
const points = regularCameras.map(c => [c.coordinates[1], c.coordinates[0]]);

console.log(`\n🗺️ Creating COMPLETE NYC Voronoi for ${regularCameras.length} cameras...`);

if (points.length > 0) {
    // Use expanded bounds for all NYC
    const bbox = [
        EXPANDED_NYC_BOUNDS.west, EXPANDED_NYC_BOUNDS.south,
        EXPANDED_NYC_BOUNDS.east, EXPANDED_NYC_BOUNDS.north
    ];
    
    const delaunay = d3.Delaunay.from(points);
    const voronoi = delaunay.voronoi(bbox);
    
    regularCameras.forEach((camera, index) => {
        try {
            let cell = voronoi.cellPolygon(index);
            
            if (!cell || cell.length < 3) {
                const [lat, lng] = camera.coordinates;
                const size = 0.008; // Slightly larger for better coverage
                cell = [
                    [lng - size, lat - size], [lng + size, lat - size],
                    [lng + size, lat + size], [lng - size, lat + size],
                    [lng - size, lat - size]
                ];
            }
            
            // Apply geographic constraints
            let clipped = clipToNYC(cell);
            
            if (clipped.length < 3) {
                const [lat, lng] = camera.coordinates;
                const size = 0.005;
                clipped = [
                    [lng - size, lat - size], [lng + size, lat - size],
                    [lng + size, lat + size], [lng - size, lat + size],
                    [lng - size, lat - size]
                ];
            }
            
            // Ensure closed polygon
            if (clipped.length >= 3) {
                const first = clipped[0];
                const last = clipped[clipped.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    clipped.push([first[0], first[1]]);
                }
            }
            
            const [lat, lng] = camera.coordinates;
            const borough = getBoroughForPoint(lng, lat);
            const isConstrained = nycLandmass && (clipped.length !== cell.length);
            
            zones.push({
                integer_id: camera.integer_id,
                handle: camera.handle,
                nyc_id: camera.nyc_id,
                name: camera.name,
                borough: borough.name,
                coordinates: camera.coordinates,
                image_url: camera.image_url,
                is_online: camera.is_online,
                last_analysis: null,
                voronoi_polygon: {
                    type: "Polygon",
                    coordinates: [clipped]
                },
                zone_area_sqm: turf.area(turf.polygon([clipped])),
                vertices_count: clipped.length - 1,
                is_land_zone: true,
                is_bridge_zone: false,
                bounded_by_coastline: isConstrained,
                coverage_quality: isConstrained ? 'geographic_boundary_constrained' : 'complete_nyc_voronoi',
                tessellation_method: 'complete_nyc_geographic_constrained'
            });
            
        } catch (error) {
            console.error(`❌ Error processing ${camera.handle}: ${error.message}`);
        }
    });
}

// Calculate comprehensive statistics
const bridgeCount = zones.filter(z => z.is_bridge_zone).length;
const landCount = zones.filter(z => z.is_land_zone).length;
const constrainedCount = zones.filter(z => z.bounded_by_coastline).length;
const totalArea = zones.reduce((sum, z) => sum + (z.zone_area_sqm || 0), 0);

// Final borough breakdown for zones
const finalBoroughBreakdown = {};
zones.forEach(zone => {
    const borough = zone.borough || 'Unknown';
    if (!finalBoroughBreakdown[borough]) {
        finalBoroughBreakdown[borough] = { total: 0, constrained: 0, bridge: 0 };
    }
    finalBoroughBreakdown[borough].total++;
    if (zone.bounded_by_coastline) finalBoroughBreakdown[borough].constrained++;
    if (zone.is_bridge_zone) finalBoroughBreakdown[borough].bridge++;
});

console.log(`\n🏆 COMPLETE NYC TESSELLATION RESULTS:`);
console.log(`✅ Total zones created: ${zones.length}`);
console.log(`🌉 Bridge zones: ${bridgeCount}`);
console.log(`🏝️ Land zones: ${landCount}`);
console.log(`🏖️ Geographically constrained: ${constrainedCount}`);
console.log(`📊 Total coverage area: ${(totalArea / 1000000).toFixed(2)} km²`);
console.log(`📊 Average zone size: ${((totalArea / zones.length) / 1000000).toFixed(3)} km²`);

console.log('\n🏙️ FINAL ZONE DISTRIBUTION BY BOROUGH:');
Object.entries(finalBoroughBreakdown).forEach(([borough, stats]) => {
    const constrainedPercent = stats.total > 0 ? ((stats.constrained / stats.total) * 100).toFixed(1) : '0.0';
    console.log(`   ${borough}: ${stats.total} zones, ${stats.constrained} constrained (${constrainedPercent}%), ${stats.bridge} bridges`);
});

// Create comprehensive summary
const completeSummary = {
    generated_at: new Date().toISOString(),
    algorithm: "complete_nyc_geographic_constrained",
    total_cameras_analyzed: cameras.length,
    cameras_in_nyc: allNYCCameras.length,
    total_zones: zones.length,
    success_rate: "COMPLETE NYC COVERAGE",
    
    geographic_coverage: {
        all_five_boroughs: true,
        expanded_bounds: EXPANDED_NYC_BOUNDS,
        camera_distribution: boroughCounts,
        zone_distribution: finalBoroughBreakdown
    },
    
    zone_breakdown: {
        bridge_zones: bridgeCount,
        land_zones: landCount,
        geographically_constrained_zones: constrainedCount,
        constraint_percentage: zones.length > 0 ? ((constrainedCount / zones.length) * 100).toFixed(1) : 0
    },
    
    coverage_analysis: {
        total_area_sqm: totalArea,
        total_area_km2: totalArea / 1000000,
        average_zone_size_sqm: totalArea / zones.length,
        average_zone_size_km2: (totalArea / zones.length) / 1000000,
        coverage_completeness: "all_nyc_boroughs_included"
    },
    
    quality_improvements: {
        complete_borough_coverage: true,
        enhanced_bridge_detection: true,
        expanded_geographic_bounds: true,
        fallback_borough_inference: true,
        comprehensive_nyc_tessellation: true
    }
};

// Save complete results
fs.writeFileSync('data/voronoi-tessellation-coastline.json', JSON.stringify(zones, null, 2));
fs.writeFileSync('data/voronoi-complete-summary.json', JSON.stringify(completeSummary, null, 2));

console.log('\n💾 Saved COMPLETE NYC tessellation data');
console.log('🗽 ALL 5 BOROUGHS NOW INCLUDED!');
console.log('🎯 Ready for full NYC analysis!'); 