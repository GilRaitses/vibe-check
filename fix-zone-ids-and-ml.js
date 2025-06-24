const fs = require('fs');

console.log('🔧 COMPREHENSIVE ZONE ID AND ML ANALYTICS FIX');
console.log('================================================');

async function fixZoneIdsAndMLConnection() {
  try {
    // 1. Load camera data from camera-zones-final.json (this has the actual camera data)
    console.log('📋 1. Loading camera data...');
    const camerasData = JSON.parse(fs.readFileSync('data/camera-zones-final.json', 'utf8'));
    console.log(`✅ Loaded ${camerasData.length} cameras from camera-zones-final.json`);

    // Create borough mappings
    const boroughMap = {
      'Manhattan': 'MN',
      'Brooklyn': 'BK', 
      'Queens': 'QN',
      'Bronx': 'BX',
      'Staten Island': 'SI',
      'Unknown': 'UN'
    };

    // 2. Load tessellation zones
    console.log('🗺️ 2. Loading tessellation zones...');
    const zonesFile = JSON.parse(fs.readFileSync('data/complete_voronoi_zones.json', 'utf8'));
    const zones = zonesFile.zones || [];
    console.log(`✅ Loaded ${zones.length} zones`);

    // 3. Update zone IDs with proper format: BB_###
    console.log('🏷️ 3. Updating zone IDs to proper format...');
    let updatedZones = 0;
    
    for (let zone of zones) {
      if (zone.integer_id) {
        // Find matching camera by array index (integer_id - 1 since arrays are 0-indexed)
        const cameraIndex = zone.integer_id - 1;
        const camera = camerasData[cameraIndex];
        
        if (camera) {
          // Extract borough from camera data
          let borough = 'UN'; // Default to Unknown
          
          // First try the camera's existing borough field
          if (camera.borough && boroughMap[camera.borough]) {
            borough = boroughMap[camera.borough];
          } else {
            // Try to determine borough from camera name or existing zone name
            const names = [camera.name || '', zone.name || ''].join(' ').toLowerCase();
            
            if (names.includes('manhattan') || names.includes('times square') || names.includes('broadway') || 
                names.includes('hell') || names.includes('8th ave') || names.includes('7th ave') ||
                names.includes('central park') || names.includes('wall st') || names.includes('east side')) {
              borough = 'MN';
            } else if (names.includes('brooklyn') || names.includes('atlantic ave') || names.includes('flatbush') ||
                      names.includes('prospect') || names.includes('bay ridge')) {
              borough = 'BK';
            } else if (names.includes('queens') || names.includes('hylan') || names.includes('astoria') ||
                      names.includes('flushing') || names.includes('jamaica')) {
              borough = 'QN';
            } else if (names.includes('bronx') || names.includes('yankee') || names.includes('concourse')) {
              borough = 'BX';
            } else if (names.includes('staten') || names.includes('richmond')) {
              borough = 'SI';
            }
          }

          // Create new zone ID: Borough (2 char) + underscore + camera number (3 char zero-padded)
          const newZoneId = `${borough}_${String(zone.integer_id).padStart(3, '0')}`;
          
          // Update zone properties
          zone.zone_id = newZoneId;
          zone.old_handle = zone.handle; // Keep old handle for reference
          zone.handle = newZoneId; // Update handle to new format
          zone.borough = borough;
          zone.camera_name = camera.name;
          zone.camera_handle = camera.handle; // Original camera handle
          
          // Ensure coordinates are in the right format [longitude, latitude]
          if (zone.coordinates && zone.coordinates.length === 2) {
            // If coordinates are [lat, lng], swap them to [lng, lat]
            if (zone.coordinates[0] > 0 && zone.coordinates[0] < 90) {
              zone.coordinates = [zone.coordinates[1], zone.coordinates[0]];
            }
          } else if (camera.coordinates && camera.coordinates.length === 2) {
            // Use camera coordinates, ensuring correct format
            if (camera.coordinates[0] > 0 && camera.coordinates[0] < 90) {
              // Camera coords are [lat, lng], convert to [lng, lat]
              zone.coordinates = [camera.coordinates[1], camera.coordinates[0]];
            } else {
              zone.coordinates = camera.coordinates;
            }
          } else {
            zone.coordinates = [-73.9851, 40.7589]; // Default NYC coordinates
          }
          
          updatedZones++;
        } else {
          console.log(`⚠️ No camera found for zone ${zone.integer_id} (index ${cameraIndex})`);
        }
      }
    }

    console.log(`✅ Updated ${updatedZones} zones with proper IDs`);

    // 4. Save updated zones
    console.log('💾 4. Saving updated tessellation data...');
    const updatedZonesData = {
      zones: zones,
      metadata: {
        ...zonesFile.metadata,
        total_zones: zones.length,
        updated_zones: updatedZones,
        last_updated: new Date().toISOString(),
        zone_id_format: 'BB_###',
        description: 'Borough (2 char) + underscore + camera number (3 char zero-padded)',
        camera_data_source: 'camera-zones-final.json',
        fix_applied: true
      }
    };
    
    fs.writeFileSync('data/complete_voronoi_zones.json', JSON.stringify(updatedZonesData, null, 2));
    console.log('✅ Saved updated tessellation data');

    // 5. Create zone lookup table for quick access
    console.log('🔍 5. Creating zone lookup table...');
    const zoneLookup = {};
    zones.forEach(zone => {
      if (zone.zone_id && zone.integer_id) {
        zoneLookup[zone.integer_id] = {
          zone_id: zone.zone_id,
          handle: zone.handle,
          old_handle: zone.old_handle,
          camera_handle: zone.camera_handle,
          borough: zone.borough,
          camera_name: zone.camera_name,
          coordinates: zone.coordinates
        };
      }
    });

    fs.writeFileSync('data/zone-lookup.json', JSON.stringify(zoneLookup, null, 2));
    console.log(`✅ Created lookup table with ${Object.keys(zoneLookup).length} entries`);

    // 6. Show sample of new zone IDs by borough
    console.log('\n📋 SAMPLE OF NEW ZONE IDS BY BOROUGH:');
    console.log('====================================');
    
    const boroughSamples = {};
    Object.entries(zoneLookup).forEach(([cameraId, zone]) => {
      if (!boroughSamples[zone.borough]) {
        boroughSamples[zone.borough] = [];
      }
      if (boroughSamples[zone.borough].length < 3) {
        boroughSamples[zone.borough].push(`${zone.zone_id}: ${zone.camera_name}`);
      }
    });

    Object.entries(boroughSamples).forEach(([borough, samples]) => {
      console.log(`\n${borough} (${samples.length} samples):`);
      samples.forEach(sample => console.log(`  ${sample}`));
    });

    // 7. Create borough summary
    const boroughCounts = {};
    Object.values(zoneLookup).forEach(zone => {
      boroughCounts[zone.borough] = (boroughCounts[zone.borough] || 0) + 1;
    });

    console.log('\n📊 BOROUGH DISTRIBUTION:');
    console.log('=======================');
    Object.entries(boroughCounts).forEach(([borough, count]) => {
      const percentage = ((count / Object.keys(zoneLookup).length) * 100).toFixed(1);
      console.log(`${borough}: ${count} zones (${percentage}%)`);
    });

    console.log('\n✅ ZONE ID FIX COMPLETE!');
    console.log('📌 Format: Borough (2 char) + underscore + camera number (3 char)');
    console.log('📌 Examples: MN_001, BK_042, QN_156, etc.');
    console.log('📌 Old handles preserved in old_handle field');
    console.log('📌 Camera handles preserved in camera_handle field');

  } catch (error) {
    console.error('❌ Error fixing zone IDs:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the fix
fixZoneIdsAndMLConnection(); 