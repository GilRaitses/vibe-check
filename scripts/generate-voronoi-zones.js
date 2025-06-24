const fs = require('fs');

// Load the cameras with handles
const cameras = JSON.parse(fs.readFileSync('data/cameras-with-handles.json', 'utf8'));

console.log(`Generating Voronoi tessellation for ${cameras.length} cameras...`);

// Simple Voronoi tessellation using distance calculations
function generateVoronoiZones(cameras) {
  const voronoiZones = [];
  
  // For each camera, create a polygon zone
  cameras.forEach((camera, index) => {
    const [lat, lng] = camera.coordinates;
    
    // Find nearest neighbors (for more accurate tessellation)
    const neighbors = cameras
      .filter(c => c.integer_id !== camera.integer_id)
      .map(c => ({
        ...c,
        distance: calculateDistance(lat, lng, c.coordinates[0], c.coordinates[1])
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8); // Use 8 nearest neighbors
    
    // Generate polygon boundaries (simplified octagon around camera point)
    const polygon = generatePolygonFromNeighbors(camera, neighbors);
    
    voronoiZones.push({
      ...camera,
      voronoi_polygon: polygon,
      zone_area_sqm: calculatePolygonArea(polygon),
      nearest_neighbors: neighbors.slice(0, 3).map(n => ({
        integer_id: n.integer_id,
        handle: n.handle,
        distance_m: Math.round(n.distance * 1000)
      }))
    });
    
    if ((index + 1) % 100 === 0) {
      console.log(`  Processed ${index + 1}/${cameras.length} zones...`);
    }
  });
  
  return voronoiZones;
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

function generatePolygonFromNeighbors(camera, neighbors) {
  const [centerLat, centerLng] = camera.coordinates;
  
  // Calculate average distance to neighbors to set polygon size
  const avgDistance = neighbors.reduce((sum, n) => sum + n.distance, 0) / neighbors.length;
  const radius = avgDistance / 2; // Half the average distance to neighbors
  
  // Generate octagon points around camera center
  const points = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * 2 * Math.PI) / 8;
    const lat = centerLat + (radius * Math.cos(angle)) / 111; // Rough conversion
    const lng = centerLng + (radius * Math.sin(angle)) / (111 * Math.cos(centerLat * Math.PI / 180));
    points.push([lng, lat]); // GeoJSON format: [longitude, latitude]
  }
  
  // Close the polygon
  points.push(points[0]);
  
  return {
    type: "Polygon",
    coordinates: [points]
  };
}

function calculatePolygonArea(polygon) {
  // Rough area calculation in square meters
  const coords = polygon.coordinates[0];
  let area = 0;
  
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    area += (lng2 - lng1) * (lat2 + lat1);
  }
  
  area = Math.abs(area) / 2;
  
  // Convert to square meters (very rough approximation)
  const metersPerDegree = 111000;
  return area * metersPerDegree * metersPerDegree;
}

// Generate zones by borough for better processing
const boroughs = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
const allZones = [];

boroughs.forEach(borough => {
  console.log(`\nProcessing ${borough}...`);
  const boroughCameras = cameras.filter(c => c.borough === borough);
  console.log(`  ${boroughCameras.length} cameras in ${borough}`);
  
  const boroughZones = generateVoronoiZones(boroughCameras);
  allZones.push(...boroughZones);
  
  console.log(`  Generated ${boroughZones.length} zones for ${borough}`);
});

// Calculate summary statistics
const totalArea = allZones.reduce((sum, zone) => sum + zone.zone_area_sqm, 0);
const avgAreaPerZone = totalArea / allZones.length;

console.log(`\n=== TESSELLATION COMPLETE ===`);
console.log(`Total zones: ${allZones.length}`);
console.log(`Total coverage area: ${(totalArea / 1000000).toFixed(2)} km²`);
console.log(`Average zone size: ${(avgAreaPerZone / 1000).toFixed(2)} m²`);

// Show sample zones
console.log(`\nSample zones:`);
allZones.slice(0, 5).forEach(zone => {
  console.log(`  ${zone.integer_id}: ${zone.handle} - ${(zone.zone_area_sqm / 1000).toFixed(1)}m² (${zone.nearest_neighbors.length} neighbors)`);
});

// Save the complete dataset
fs.writeFileSync('data/camera-zones-complete.json', JSON.stringify(allZones, null, 2));
console.log(`\n✅ Saved complete tessellation to data/camera-zones-complete.json`);

// Create a summary file for quick reference
const summary = {
  total_zones: allZones.length,
  total_area_km2: totalArea / 1000000,
  by_borough: boroughs.map(borough => ({
    name: borough,
    zone_count: allZones.filter(z => z.borough === borough).length,
    area_km2: allZones.filter(z => z.borough === borough)
                    .reduce((sum, z) => sum + z.zone_area_sqm, 0) / 1000000
  })),
  generated_at: new Date().toISOString()
};

fs.writeFileSync('data/tessellation-summary.json', JSON.stringify(summary, null, 2));
console.log(`📊 Saved summary to data/tessellation-summary.json`); 