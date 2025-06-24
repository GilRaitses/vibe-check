const fs = require('fs');

// Load enhanced zones and original camera data
const zones = JSON.parse(fs.readFileSync('data/camera-zones-enhanced.json', 'utf8'));
const allCameras = JSON.parse(fs.readFileSync('data/nyc-cameras-full.json', 'utf8'));

console.log(`Adding street/avenue limit names to ${zones.length} zones...`);

function extractStreetFromName(cameraName) {
  // Extract street information from camera names like "Broadway @ 42 St"
  const patterns = [
    /^(.+?)\s+@\s+(.+?)$/,           // "Broadway @ 42 St"
    /^(.+?)\s+&\s+(.+?)$/,            // "5th Ave & 42nd St"  
    /^(.+?)\s+\/\s+(.+?)$/,           // "FDR Dr / 96 St"
    /^(.+?)\s+-\s+(.+?)$/,            // "West Side HWY - 42nd St"
    /^(.+?)\s+at\s+(.+?)$/i,          // "Amsterdam at 72nd St"
  ];
  
  for (let pattern of patterns) {
    const match = cameraName.match(pattern);
    if (match) {
      return {
        primary_street: match[1].trim(),
        secondary_street: match[2].trim(),
        intersection: `${match[1].trim()} & ${match[2].trim()}`
      };
    }
  }
  
  // Fallback: try to extract any street-like terms
  const streetMatch = cameraName.match(/(.*?)(Ave|Street|St|Road|Rd|Drive|Dr|Boulevard|Blvd|Highway|HWY|Parkway|Pkwy)/i);
  if (streetMatch) {
    return {
      primary_street: (streetMatch[1] + streetMatch[2]).trim(),
      secondary_street: null,
      intersection: (streetMatch[1] + streetMatch[2]).trim()
    };
  }
  
  return {
    primary_street: cameraName,
    secondary_street: null,
    intersection: cameraName
  };
}

function findLimitCameras(zones, allCameras) {
  const limitCameras = {};
  
  zones.forEach(zone => {
    const bbox = zone.bounding_box;
    
    // Find cameras closest to each limit
    const northernmostCam = allCameras
      .filter(cam => Math.abs(cam.latitude - bbox.north) < 0.001)
      .sort((a, b) => Math.abs(b.latitude - bbox.north) - Math.abs(a.latitude - bbox.north))[0];
      
    const southernmostCam = allCameras
      .filter(cam => Math.abs(cam.latitude - bbox.south) < 0.001)
      .sort((a, b) => Math.abs(a.latitude - bbox.south) - Math.abs(b.latitude - bbox.south))[0];
      
    const easternmostCam = allCameras
      .filter(cam => Math.abs(cam.longitude - bbox.east) < 0.001)
      .sort((a, b) => Math.abs(b.longitude - bbox.east) - Math.abs(a.longitude - bbox.east))[0];
      
    const westernmostCam = allCameras
      .filter(cam => Math.abs(cam.longitude - bbox.west) < 0.001)
      .sort((a, b) => Math.abs(a.longitude - bbox.west) - Math.abs(b.longitude - bbox.west))[0];
    
    // Extract street names for limits
    const streetLimits = {
      north_limit: northernmostCam ? extractStreetFromName(northernmostCam.name) : null,
      south_limit: southernmostCam ? extractStreetFromName(southernmostCam.name) : null,
      east_limit: easternmostCam ? extractStreetFromName(easternmostCam.name) : null,
      west_limit: westernmostCam ? extractStreetFromName(westernmostCam.name) : null
    };
    
    limitCameras[zone.integer_id] = streetLimits;
  });
  
  return limitCameras;
}

function addStreetLimitsToZone(zone, streetLimits) {
  const limits = streetLimits[zone.integer_id];
  
  return {
    ...zone,
    street_limits: {
      northernmost_street: limits?.north_limit?.intersection || "Unknown",
      southernmost_street: limits?.south_limit?.intersection || "Unknown", 
      easternmost_street: limits?.east_limit?.intersection || "Unknown",
      westernmost_street: limits?.west_limit?.intersection || "Unknown",
      primary_streets: {
        north: limits?.north_limit?.primary_street,
        south: limits?.south_limit?.primary_street,
        east: limits?.east_limit?.primary_street,
        west: limits?.west_limit?.primary_street
      }
    },
    camera_metadata: {
      camera_url: `https://webcams.nyctmc.org/api/cameras/${zone.handle}/image`,
      last_image_timestamp: new Date().toISOString(),
      zone_priority: calculateZonePriority(zone),
      hover_info: {
        title: `${zone.handle} - ${zone.name}`,
        area: `${(zone.zone_area_sqm / 1000000).toFixed(3)} km²`,
        max_reach: `${zone.zone_reach.max_reach_m}m`,
        density_rank: `#${zone.zone_metadata.density_rank}/940`,
        coordinates: `${zone.coordinates[0].toFixed(4)}, ${zone.coordinates[1].toFixed(4)}`
      }
    }
  };
}

function calculateZonePriority(zone) {
  // Higher priority for smaller zones (higher density) and border zones
  let priority = 1000 - zone.zone_metadata.density_rank; // Higher rank = higher priority
  
  if (zone.zone_metadata.is_border_zone) priority += 100;
  if (zone.zone_reach.max_reach_m < 100) priority += 50; // Very small zones
  if (zone.borough === 'Manhattan') priority += 25; // Manhattan gets slight boost
  
  return priority;
}

// Process zones
console.log('Finding limit cameras for street name extraction...');
const streetLimits = findLimitCameras(zones, allCameras);

console.log('Adding street limits to zones...');
const zonesWithStreetLimits = zones.map((zone, index) => {
  if ((index + 1) % 100 === 0) {
    console.log(`  Processed ${index + 1}/${zones.length} zones...`);
  }
  return addStreetLimitsToZone(zone, streetLimits);
});

// Save enhanced data
fs.writeFileSync('data/camera-zones-final.json', JSON.stringify(zonesWithStreetLimits, null, 2));
console.log(`✅ Saved zones with street limits to data/camera-zones-final.json`);

// Show sample
console.log('\n=== SAMPLE ZONE WITH STREET LIMITS ===');
const sample = zonesWithStreetLimits[0];
console.log(`Camera: ${sample.handle} (#${sample.integer_id})`);
console.log(`Location: ${sample.name}`);
console.log(`Street Limits:`);
console.log(`  North: ${sample.street_limits.northernmost_street}`);
console.log(`  South: ${sample.street_limits.southernmost_street}`);
console.log(`  East: ${sample.street_limits.easternmost_street}`);
console.log(`  West: ${sample.street_limits.westernmost_street}`);
console.log(`Camera Image URL: ${sample.camera_metadata.camera_url}`);
console.log(`Zone Priority: ${sample.camera_metadata.zone_priority}`);

// Update borough superstructures with street limits
const boroughSuperstructures = JSON.parse(fs.readFileSync('data/borough-superstructures.json', 'utf8'));

Object.keys(boroughSuperstructures).forEach(borough => {
  const boroughZones = zonesWithStreetLimits.filter(z => z.borough === borough);
  
  // Find overall borough street limits
  let northernmost = boroughZones.reduce((max, zone) => 
    zone.bounding_box.north > max.bounding_box.north ? zone : max);
  let southernmost = boroughZones.reduce((min, zone) => 
    zone.bounding_box.south < min.bounding_box.south ? zone : min);
  let easternmost = boroughZones.reduce((max, zone) => 
    zone.bounding_box.east > max.bounding_box.east ? zone : max);
  let westernmost = boroughZones.reduce((min, zone) => 
    zone.bounding_box.west < min.bounding_box.west ? zone : min);
  
  boroughSuperstructures[borough].street_boundaries = {
    northernmost_area: northernmost.street_limits.northernmost_street,
    southernmost_area: southernmost.street_limits.southernmost_street,
    easternmost_area: easternmost.street_limits.easternmost_street,
    westernmost_area: westernmost.street_limits.westernmost_street,
    boundary_cameras: {
      north: { handle: northernmost.handle, name: northernmost.name },
      south: { handle: southernmost.handle, name: southernmost.name },
      east: { handle: easternmost.handle, name: easternmost.name },
      west: { handle: westernmost.handle, name: westernmost.name }
    }
  };
});

fs.writeFileSync('data/borough-superstructures-final.json', JSON.stringify(boroughSuperstructures, null, 2));
console.log(`✅ Updated borough superstructures with street boundaries`);

console.log('\n=== BOROUGH STREET BOUNDARIES ===');
Object.values(boroughSuperstructures).forEach(borough => {
  console.log(`${borough.borough}:`);
  console.log(`  North: ${borough.street_boundaries.northernmost_area}`);
  console.log(`  South: ${borough.street_boundaries.southernmost_area}`);
  console.log(`  East: ${borough.street_boundaries.easternmost_area}`);
  console.log(`  West: ${borough.street_boundaries.westernmost_area}`);
}); 