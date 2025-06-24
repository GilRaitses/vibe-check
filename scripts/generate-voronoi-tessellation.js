const fs = require('fs');
const { Delaunay } = require('d3-delaunay');

// Load camera data
const cameras = JSON.parse(fs.readFileSync('data/cameras-with-handles.json', 'utf8'));

console.log(`Generating mathematical Voronoi tessellation for ${cameras.length} cameras...`);

// NYC bounding box (approximate)
const NYC_BOUNDS = {
  minLat: 40.4774,  // Staten Island south
  maxLat: 40.9176,  // Bronx north  
  minLng: -74.2591, // Staten Island west
  maxLng: -73.7004  // Queens east
};

function projectToPlane(lat, lng) {
  // Simple equirectangular projection for Voronoi calculation
  const x = (lng - NYC_BOUNDS.minLng) / (NYC_BOUNDS.maxLng - NYC_BOUNDS.minLng) * 1000;
  const y = (lat - NYC_BOUNDS.minLat) / (NYC_BOUNDS.maxLat - NYC_BOUNDS.minLat) * 1000;
  return [x, y];
}

function projectBackToGeo(x, y) {
  const lng = (x / 1000) * (NYC_BOUNDS.maxLng - NYC_BOUNDS.minLng) + NYC_BOUNDS.minLng;
  const lat = (y / 1000) * (NYC_BOUNDS.maxLat - NYC_BOUNDS.minLat) + NYC_BOUNDS.minLat;
  return [lng, lat];
}

// Project camera coordinates to 2D plane
const points = cameras.map(camera => {
  const [lat, lng] = camera.coordinates;
  return projectToPlane(lat, lng);
});

console.log('Computing Delaunay triangulation...');
const delaunay = Delaunay.from(points);

console.log('Computing Voronoi diagram...');
const voronoi = delaunay.voronoi([0, 0, 1000, 1000]); // Bounding box

// Generate Voronoi cells for each camera
const voronoiCameras = cameras.map((camera, i) => {
  const cell = voronoi.cellPolygon(i);
  
  if (!cell) {
    console.warn(`No Voronoi cell for camera ${camera.handle}`);
    return {
      ...camera,
      voronoi_polygon: null,
      zone_area_sqm: 0
    };
  }

  // Convert back to geographic coordinates
  const geoCoords = cell.map(point => projectBackToGeo(point[0], point[1]));
  
  // Close the polygon
  geoCoords.push(geoCoords[0]);
  
  // Calculate area using shoelace formula
  const area = calculatePolygonArea(geoCoords);
  
  const voronoiPolygon = {
    type: "Polygon",
    coordinates: [geoCoords]
  };

  if (i < 5) {
    console.log(`Camera ${camera.handle}: ${cell.length} vertices, ${(area/1000000).toFixed(2)} km²`);
  }

  return {
    ...camera,
    voronoi_polygon: voronoiPolygon,
    zone_area_sqm: area,
    vertices_count: cell.length
  };
});

function calculatePolygonArea(coords) {
  let area = 0;
  const n = coords.length - 1; // Exclude the duplicate last point
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coords[i][0] * coords[j][1];
    area -= coords[j][0] * coords[i][1];
  }
  
  area = Math.abs(area) / 2;
  
  // Convert to square meters (rough approximation)
  const metersPerDegree = 111000; // Approximate meters per degree at NYC latitude
  return area * metersPerDegree * metersPerDegree;
}

// Calculate statistics
const totalArea = voronoiCameras.reduce((sum, cam) => sum + cam.zone_area_sqm, 0);
const avgVertices = voronoiCameras.reduce((sum, cam) => sum + (cam.vertices_count || 0), 0) / cameras.length;
const validCells = voronoiCameras.filter(cam => cam.voronoi_polygon).length;

console.log(`\n=== VORONOI TESSELLATION COMPLETE ===`);
console.log(`Valid cells: ${validCells}/${cameras.length}`);
console.log(`Total area: ${(totalArea / 1000000).toFixed(1)} km²`);
console.log(`Average vertices per cell: ${avgVertices.toFixed(1)}`);

// Find most complex polygons
const complexPolygons = voronoiCameras
  .filter(cam => cam.vertices_count)
  .sort((a, b) => b.vertices_count - a.vertices_count)
  .slice(0, 5);

console.log(`\nMost complex polygons:`);
complexPolygons.forEach((cam, i) => {
  console.log(`  ${i+1}. ${cam.handle}: ${cam.vertices_count} vertices (${cam.borough})`);
});

// Save the tessellation
fs.writeFileSync('data/voronoi-tessellation.json', JSON.stringify(voronoiCameras, null, 2));
console.log(`\n✅ Saved mathematical Voronoi tessellation to data/voronoi-tessellation.json`);

// Create summary
const summary = {
  total_cameras: cameras.length,
  valid_voronoi_cells: validCells,
  total_area_km2: totalArea / 1000000,
  average_vertices_per_cell: avgVertices,
  tessellation_method: 'Delaunay triangulation -> Voronoi diagram',
  generated_at: new Date().toISOString(),
  most_complex_polygons: complexPolygons.map(cam => ({
    handle: cam.handle,
    name: cam.name,
    borough: cam.borough,
    vertices: cam.vertices_count,
    area_km2: cam.zone_area_sqm / 1000000
  }))
};

fs.writeFileSync('data/voronoi-summary.json', JSON.stringify(summary, null, 2));
console.log(`✅ Saved summary to data/voronoi-summary.json`);

console.log(`\nNow update the dashboard to use: data/voronoi-tessellation.json`);
console.log(`Expected: Irregular polygons with ${avgVertices.toFixed(0)}+ vertices each`); 