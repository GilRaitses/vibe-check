// Auto-generated Voronoi loader - loads territories from local computer
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_SERVER_URL = 'http://10.4.32.157:3001'; // Your computer's IP address
const TERRITORIES_ENDPOINT = '/territories';

export async function loadPrecomputedTerritories() {
  try {
    const startTime = Date.now();
    console.log('🔮 [VORONOI_LOADER] Loading territories from local computer...');
    console.log(`🌐 [VORONOI_LOADER] Fetching from: ${LOCAL_SERVER_URL}${TERRITORIES_ENDPOINT}`);
    
    // Fetch territories from local computer
    const response = await fetch(`${LOCAL_SERVER_URL}${TERRITORIES_ENDPOINT}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const territoriesData = await response.json();
    console.log(`📊 [VORONOI_LOADER] Received data keys: ${Object.keys(territoriesData).length}`);
    
    let territoriesLoaded = 0;
    let totalSize = 0;
    
    // Process and temporarily cache the territories data
    if (territoriesData.manhattan_territories_precomputed) {
      const territories = territoriesData.manhattan_territories_precomputed.territories;
      if (territories) {
        territoriesLoaded = Object.keys(territories).length;
        const jsonString = JSON.stringify(territoriesData);
        totalSize = jsonString.length;
        
        console.log(`🗺️ [VORONOI_LOADER] Loaded ${territoriesLoaded} Manhattan camera territories`);
        console.log(`📦 [VORONOI_LOADER] Territory data size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        
        // Store temporarily in memory cache for this session only
        await AsyncStorage.setItem('manhattan_territories_session_cache', jsonString);
        
        // Log sample territory for verification
        const firstTerritoryKey = Object.keys(territories)[0];
        const sampleTerritory = territories[firstTerritoryKey];
        console.log(`🔍 [VORONOI_LOADER] Sample territory (${firstTerritoryKey}):`, {
          cameraId: sampleTerritory.cameraId,
          vertices: sampleTerritory.geometry?.coordinates?.[0]?.length || 0,
          area: sampleTerritory.area,
          neighbors: sampleTerritory.neighbors?.length || 0
        });
      }
    }
    
    const loadTime = Date.now() - startTime;
    console.log(`✅ [VORONOI_LOADER] Territories loaded from computer successfully!`);
    console.log(`📊 [VORONOI_LOADER] Loaded ${territoriesLoaded} territories in ${loadTime}ms`);
    console.log(`💾 [VORONOI_LOADER] Data size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`🖥️ [VORONOI_LOADER] Data remains on computer, session cached for app use`);
    
    return true;
  } catch (error) {
    console.error('❌ [VORONOI_LOADER] Failed to load territories from computer:', error);
    console.error('❌ [VORONOI_LOADER] Make sure local server is running on your computer');
    console.error('❌ [VORONOI_LOADER] Error details:', error);
    
    // Fallback: try to use any existing session cache
    try {
      const cachedData = await AsyncStorage.getItem('manhattan_territories_session_cache');
      if (cachedData) {
        console.log('🔄 [VORONOI_LOADER] Using cached territories from previous session');
        return true;
      }
    } catch (cacheError) {
      console.error('❌ [VORONOI_LOADER] No cached data available');
    }
    
    return false;
  }
}

// Helper function to get computer IP address instructions
export function getServerSetupInstructions() {
  return {
    message: "To serve territories from your computer:",
    steps: [
      "1. Find your computer's IP address (run 'ipconfig' on Windows or 'ifconfig' on Mac/Linux)",
      "2. Update LOCAL_SERVER_URL in voronoiLoader.ts with your IP",
      "3. Run the territory server script on your computer",
      "4. Make sure your phone and computer are on the same network"
    ]
  };
}
