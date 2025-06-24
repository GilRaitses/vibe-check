const fs = require('fs');

// Load the camera zones
const zones = JSON.parse(fs.readFileSync('data/camera-zones-complete.json', 'utf8'));

console.log(`Adding bounding box metadata to ${zones.length} zones...`);

function calculateBoundingBox(polygon) {
  if (!polygon || !polygon.coordinates || !polygon.coordinates[0]) {
    return null;
  }
  
  const coords = polygon.coordinates[0];
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  
  coords.forEach(([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  
  return {
    north: maxLat,
    south: minLat,
    east: maxLng,
    west: minLng,
    width_degrees: maxLng - minLng,
    height_degrees: maxLat - minLat,
    center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
  };
}

function calculateZoneReach(zone) {
  const [centerLat, centerLng] = zone.coordinates;
  const bbox = zone.bounding_box;
  
  if (!bbox) return null;
  
  // Calculate reach in meters from center to each direction
  const northReach = calculateDistance(centerLat, centerLng, bbox.north, centerLng);
  const southReach = calculateDistance(centerLat, centerLng, bbox.south, centerLng);
  const eastReach = calculateDistance(centerLat, centerLng, centerLat, bbox.east);
  const westReach = calculateDistance(centerLat, centerLng, centerLat, bbox.west);
  
  return {
    north_reach_m: Math.round(northReach * 1000),
    south_reach_m: Math.round(southReach * 1000),
    east_reach_m: Math.round(eastReach * 1000),
    west_reach_m: Math.round(westReach * 1000),
    max_reach_m: Math.round(Math.max(northReach, southReach, eastReach, westReach) * 1000),
    total_span_m: {
      north_south: Math.round((northReach + southReach) * 1000),
      east_west: Math.round((eastReach + westReach) * 1000)
    }
  };
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Process each zone
const enhancedZones = zones.map((zone, index) => {
  const bounding_box = calculateBoundingBox(zone.voronoi_polygon);
  const zone_reach = calculateZoneReach({...zone, bounding_box});
  
  const enhanced = {
    ...zone,
    bounding_box,
    zone_reach,
    zone_metadata: {
      vertices_count: zone.voronoi_polygon?.coordinates?.[0]?.length - 1 || 0,
      perimeter_m: calculatePolygonPerimeter(zone.voronoi_polygon),
      is_border_zone: isBorderZone(zone, bounding_box),
      density_rank: null, // To be calculated later
      last_updated: new Date().toISOString()
    }
  };
  
  if ((index + 1) % 100 === 0) {
    console.log(`  Processed ${index + 1}/${zones.length} zones...`);
  }
  
  return enhanced;
});

function calculatePolygonPerimeter(polygon) {
  if (!polygon?.coordinates?.[0]) return 0;
  
  const coords = polygon.coordinates[0];
  let perimeter = 0;
  
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    perimeter += calculateDistance(lat1, lng1, lat2, lng2);
  }
  
  return Math.round(perimeter * 1000); // Convert to meters
}

function isBorderZone(zone, bbox) {
  // NYC approximate bounds
  const nycBounds = {
    north: 40.9176,  // Bronx
    south: 40.4774,  // Staten Island
    east: -73.7004,  // Queens
    west: -74.2591   // Staten Island
  };
  
  const margin = 0.01; // ~1km
  
  return bbox && (
    bbox.north >= nycBounds.north - margin ||
    bbox.south <= nycBounds.south + margin ||
    bbox.east >= nycBounds.east - margin ||
    bbox.west <= nycBounds.west + margin
  );
}

// Calculate density rankings
enhancedZones.sort((a, b) => a.zone_area_sqm - b.zone_area_sqm);
enhancedZones.forEach((zone, index) => {
  zone.zone_metadata.density_rank = index + 1; // 1 = smallest zone (highest density)
});

// Show sample enhanced zone
console.log('\n=== ENHANCED ZONE SAMPLE ===');
const sample = enhancedZones[0];
console.log(`Camera: ${sample.handle} (#${sample.integer_id})`);
console.log(`Location: ${sample.name}`);
console.log(`Bounding Box:`);
console.log(`  North: ${sample.bounding_box.north.toFixed(6)}`);
console.log(`  South: ${sample.bounding_box.south.toFixed(6)}`);
console.log(`  East: ${sample.bounding_box.east.toFixed(6)}`);
console.log(`  West: ${sample.bounding_box.west.toFixed(6)}`);
console.log(`Zone Reach:`);
console.log(`  North: ${sample.zone_reach.north_reach_m}m`);
console.log(`  South: ${sample.zone_reach.south_reach_m}m`);
console.log(`  East: ${sample.zone_reach.east_reach_m}m`);
console.log(`  West: ${sample.zone_reach.west_reach_m}m`);
console.log(`  Max Reach: ${sample.zone_reach.max_reach_m}m`);

// Save enhanced data
fs.writeFileSync('data/camera-zones-enhanced.json', JSON.stringify(enhancedZones, null, 2));
console.log(`\n✅ Saved enhanced zones to data/camera-zones-enhanced.json`);

// Calculate summary statistics
const avgZoneArea = enhancedZones.reduce((sum, z) => sum + z.zone_area_sqm, 0) / enhancedZones.length;
const maxReaches = enhancedZones.map(z => z.zone_reach.max_reach_m);
const avgMaxReach = maxReaches.reduce((sum, r) => sum + r, 0) / maxReaches.length;

console.log(`\n=== ZONE STATISTICS ===`);
console.log(`Average zone area: ${Math.round(avgZoneArea).toLocaleString()} m²`);
console.log(`Average max reach: ${Math.round(avgMaxReach)} meters`);
console.log(`Border zones: ${enhancedZones.filter(z => z.zone_metadata.is_border_zone).length}`);

// Show zones with largest reach
console.log(`\n=== LARGEST ZONES BY REACH ===`);
enhancedZones
  .sort((a, b) => b.zone_reach.max_reach_m - a.zone_reach.max_reach_m)
  .slice(0, 5)
  .forEach((zone, i) => {
    console.log(`  ${i+1}. ${zone.handle} - ${zone.zone_reach.max_reach_m}m reach (${zone.borough})`);
  }); 