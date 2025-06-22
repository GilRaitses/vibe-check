// Proximity-based Camera Service
// Prioritizes cameras by distance to user location
// Loads precomputed Voronoi territories silently on startup

import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadPrecomputedTerritories } from './voronoiLoader';

export interface ProximityCamera {
  id: string;
  lat: number;
  lng: number;
  name: string;
  distance: number; // in meters
  priority: number; // 1-5 (1 = highest priority)
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

class ProximityService {
  private userLocation: UserLocation | null = null;
  private precomputedLoaded = false;

  /**
   * Initialize proximity service with user location
   */
  async initialize(userLocation: UserLocation): Promise<void> {
    console.log('📍 [PROXIMITY] Initializing with user location:', userLocation);
    this.userLocation = userLocation;
    
    // Load precomputed territories silently
    if (!this.precomputedLoaded) {
      await this.loadPrecomputedTerritories();
    }
  }

  /**
   * Get cameras sorted by proximity to user (closest first)
   */
  getCamerasByProximity(cameras: any[], maxDistance: number = 2000): ProximityCamera[] {
    if (!this.userLocation) {
      console.warn('⚠️ [PROXIMITY] User location not set, returning unsorted cameras');
      return cameras.map((cam, index) => ({
        id: cam.id,
        lat: cam.lat || cam.latitude,
        lng: cam.lng || cam.longitude,
        name: cam.name || `Camera ${index + 1}`,
        distance: 0,
        priority: 3
      }));
    }

    console.log(`🎯 [PROXIMITY] Sorting ${cameras.length} cameras by distance to user`);
    
    const proximityCameras: ProximityCamera[] = cameras
      .map(camera => {
        const lat = camera.lat || camera.latitude;
        const lng = camera.lng || camera.longitude;
        
        if (!lat || !lng) return null;
        
        const distance = this.calculateDistance(
          this.userLocation!.latitude,
          this.userLocation!.longitude,
          lat,
          lng
        );
        
        return {
          id: camera.id,
          lat,
          lng,
          name: camera.name || `Camera ${camera.id}`,
          distance,
          priority: this.calculatePriority(distance)
        };
      })
      .filter((cam): cam is ProximityCamera => cam !== null)
      .filter(cam => cam.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance);

    console.log(`✅ [PROXIMITY] Found ${proximityCameras.length} cameras within ${maxDistance}m`);
    console.log(`📊 [PROXIMITY] Closest camera: ${proximityCameras[0]?.name} (${Math.round(proximityCameras[0]?.distance || 0)}m)`);
    
    return proximityCameras;
  }

  /**
   * Get cameras in concentric rings around user
   */
  getCamerasByRings(cameras: any[]): { [ring: string]: ProximityCamera[] } {
    const rings = {
      immediate: [] as ProximityCamera[], // 0-500m
      nearby: [] as ProximityCamera[],    // 500-1000m
      area: [] as ProximityCamera[],      // 1000-2000m
      distant: [] as ProximityCamera[]    // 2000m+
    };

    const proximityCameras = this.getCamerasByProximity(cameras, 5000);
    
    proximityCameras.forEach(camera => {
      if (camera.distance <= 500) {
        rings.immediate.push(camera);
      } else if (camera.distance <= 1000) {
        rings.nearby.push(camera);
      } else if (camera.distance <= 2000) {
        rings.area.push(camera);
      } else {
        rings.distant.push(camera);
      }
    });

    console.log('🎯 [PROXIMITY] Camera distribution:');
    console.log(`   Immediate (0-500m): ${rings.immediate.length} cameras`);
    console.log(`   Nearby (500-1000m): ${rings.nearby.length} cameras`);
    console.log(`   Area (1000-2000m): ${rings.area.length} cameras`);
    console.log(`   Distant (2000m+): ${rings.distant.length} cameras`);

    return rings;
  }

  /**
   * Calculate distance between two points in meters
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calculate priority based on distance (1 = highest, 5 = lowest)
   */
  private calculatePriority(distance: number): number {
    if (distance <= 200) return 1; // Immediate priority
    if (distance <= 500) return 2; // High priority
    if (distance <= 1000) return 3; // Medium priority
    if (distance <= 2000) return 4; // Low priority
    return 5; // Lowest priority
  }

  /**
   * Load precomputed Voronoi territories from JSON file into AsyncStorage
   */
  private async loadPrecomputedTerritories(): Promise<void> {
    try {
      console.log('🔮 [PROXIMITY] Triggering Voronoi territories loading...');
      
      const success = await loadPrecomputedTerritories();
      
      if (success) {
        this.precomputedLoaded = true;
        console.log('✅ [PROXIMITY] Voronoi territories successfully loaded into AsyncStorage');
        
        // Verify the data was loaded
        await this.verifyTerritoriesLoaded();
      } else {
        console.error('❌ [PROXIMITY] Failed to load Voronoi territories');
      }
      
    } catch (error) {
      console.error('❌ [PROXIMITY] Error loading precomputed territories:', error);
    }
  }

  /**
   * Verify that territories were actually loaded into AsyncStorage
   */
  private async verifyTerritoriesLoaded(): Promise<void> {
    try {
      console.log('🔍 [PROXIMITY] Verifying territories were loaded into AsyncStorage...');
      
      const storedData = await AsyncStorage.getItem('manhattan_territories_session_cache');
      
      if (storedData) {
        const parsed = JSON.parse(storedData);
        const territories = parsed.manhattan_territories_precomputed?.territories || {};
        const territoryCount = Object.keys(territories).length;
        console.log(`✅ [PROXIMITY] Verification successful: ${territoryCount} territories found in session cache`);
        console.log(`📦 [PROXIMITY] Session cache data size: ${(storedData.length / 1024 / 1024).toFixed(2)} MB`);
        
        // Log a sample territory to verify structure
        const firstKey = Object.keys(territories)[0];
        if (firstKey) {
          const sample = territories[firstKey];
          console.log(`🔍 [PROXIMITY] Sample territory verification:`, {
            id: sample.id,
            cameraId: sample.cameraId,
            hasGeometry: !!sample.geometry,
            vertices: sample.geometry?.coordinates?.[0]?.length || 0,
            area: sample.area,
            neighbors: sample.neighbors?.length || 0
          });
        }
      } else {
        console.error('❌ [PROXIMITY] Verification failed: No territories found in session cache');
      }
    } catch (error) {
      console.error('❌ [PROXIMITY] Error verifying territories:', error);
    }
  }

  /**
   * Get analysis priority queue (closest cameras first)
   */
  getAnalysisPriorityQueue(cameras: any[], maxCameras: number = 10): ProximityCamera[] {
    const priorityCameras = this.getCamerasByProximity(cameras, 1500);
    const queue = priorityCameras.slice(0, maxCameras);
    
    console.log(`🎯 [PROXIMITY] Analysis priority queue: ${queue.length} cameras`);
    queue.forEach((cam, index) => {
      console.log(`   ${index + 1}. ${cam.name} (${Math.round(cam.distance)}m, priority ${cam.priority})`);
    });
    
    return queue;
  }
}

export default new ProximityService(); 