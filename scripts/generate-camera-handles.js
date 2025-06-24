const fs = require('fs');

// Load the camera data
const cameras = JSON.parse(fs.readFileSync('data/nyc-cameras-full.json', 'utf8'));

console.log(`Processing ${cameras.length} cameras...`);

function generateHandle(camera, index) {
  // Borough codes
  const boroughCodes = {
    'Manhattan': 'MN',
    'Brooklyn': 'BK', 
    'Queens': 'QN',
    'Bronx': 'BX',
    'Staten Island': 'SI'
  };

  // Extract street information from name
  const name = camera.name;
  let handle = boroughCodes[camera.area] || 'XX';
  
  // Extract numbers and street names
  const streetMatch = name.match(/(\d+)\s*(\w+).*@.*(\d+)\s*(\w+)/);
  if (streetMatch) {
    // Format: "12 Ave @ 42 St" -> MN12A42S
    const [, num1, st1, num2, st2] = streetMatch;
    handle += num1 + st1.charAt(0).toUpperCase() + num2 + st2.charAt(0).toUpperCase();
  } else {
    // Fallback: use first letters of each word
    const words = name.replace(/[@&]/g, '').split(/\s+/).filter(w => w.length > 0);
    const letters = words.map(w => w.charAt(0).toUpperCase()).join('').substring(0, 6);
    handle += letters;
  }
  
  // Ensure unique handles by adding sequence if needed
  return handle.substring(0, 8);
}

// Process all cameras
const processedCameras = cameras.map((camera, index) => {
  const handle = generateHandle(camera, index);
  
  return {
    integer_id: index + 1,
    handle: handle,
    nyc_id: camera.id,
    name: camera.name,
    borough: camera.area,
    coordinates: [camera.latitude, camera.longitude],
    image_url: camera.imageUrl,
    is_online: camera.isOnline === "true",
    last_analysis: null,
    voronoi_polygon: null // To be filled by tessellation
  };
});

// Group by borough to see distribution
const byBorough = processedCameras.reduce((acc, cam) => {
  acc[cam.borough] = (acc[cam.borough] || 0) + 1;
  return acc;
}, {});

console.log('\nCameras by borough:');
Object.entries(byBorough).forEach(([borough, count]) => {
  console.log(`  ${borough}: ${count} cameras`);
});

// Show first 10 handles as examples
console.log('\nFirst 10 camera handles:');
processedCameras.slice(0, 10).forEach(cam => {
  console.log(`  ${cam.integer_id}: ${cam.handle} - ${cam.name} (${cam.borough})`);
});

// Save processed data
fs.writeFileSync('data/cameras-with-handles.json', JSON.stringify(processedCameras, null, 2));
console.log(`\nSaved ${processedCameras.length} cameras with handles to data/cameras-with-handles.json`);

// Generate summary stats
const handleLengths = processedCameras.map(c => c.handle.length);
const avgLength = handleLengths.reduce((a, b) => a + b, 0) / handleLengths.length;
const minLength = Math.min(...handleLengths);
const maxLength = Math.max(...handleLengths);

console.log(`\nHandle statistics:`);
console.log(`  Average length: ${avgLength.toFixed(1)} characters`);
console.log(`  Range: ${minLength}-${maxLength} characters`);
console.log(`  Total cameras: ${processedCameras.length}`); 