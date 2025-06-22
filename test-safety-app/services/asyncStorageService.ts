import AsyncStorage from '@react-native-async-storage/async-storage';
import { NYCCamera } from './nycCameraService';

// Enhanced camera metadata with persistent Voronoi data
export interface CameraMetadata {
  id: string;
  camera: NYCCamera;
  
  // Voronoi geometry (calculated once, saved forever)
  voronoiCell: {
    polygon: Array<{latitude: number; longitude: number}>;
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
    area: number; // Square kilometers
    perimeter: number; // Kilometers
    neighbors: string[]; // IDs of adjacent cameras
    calculatedAt: Date;
    version: string; // For future updates to algorithm
  };
  
  // Analysis history (aggregated across sessions/users)
  analysisHistory: {
    totalAnalyses: number;
    averageRiskScore: number;
    riskScoreHistory: Array<{
      score: number;
      timestamp: Date;
      userId?: string; // Anonymous user ID
      sessionId?: string;
    }>;
    lastUpdated: Date;
  };
  
  // External data cache (from DataSourceService)
  externalDataCache: {
    timeData?: any;
    weatherData?: any;
    infrastructureData?: any;
    historicalData?: any;
    trafficData?: any;
    lastUpdated?: Date;
    cacheExpiry?: Date; // When this data expires
  };
  
  // Real-time state (session-specific)
  currentState: {
    analysisState: 'unanalyzed' | 'queued' | 'analyzing' | 'completed' | 'error';
    currentRiskScore?: number;
    lastAnalyzed?: Date;
    isVisible: boolean; // Currently visible on map
    isNearUser: boolean; // Within user's safety bubble
  };
  
  // Performance metrics
  performance: {
    voronoiCalculationTime: number; // Milliseconds
    lastGeometryUpdate: Date;
    cacheHits: number;
    cacheMisses: number;
  };
}

// Central dataset for all camera metadata
export interface CameraMetadataDataset {
  version: string;
  lastUpdated: Date;
  totalCameras: number;
  manhattanCameras: number;
  voronoiCalculationComplete: boolean;
  cameras: Map<string, CameraMetadata>;
  
  // Global statistics
  statistics: {
    totalAnalyses: number;
    averageRiskScore: number;
    mostAnalyzedCamera: string;
    safestArea: string;
    riskiestArea: string;
    lastGlobalUpdate: Date;
  };
}

class AsyncStorageService {
  private readonly STORAGE_KEY = 'camera_metadata_dataset';
  private readonly BACKUP_STORAGE_KEY = 'camera_metadata_backup';
  private readonly VERSION = '1.0.0';
  
  private dataset: CameraMetadataDataset | null = null;
  private isLoaded = false;
  private saveTimeout: NodeJS.Timeout | null = null;
  
  // Performance tracking
  private loadTime = 0;
  private saveTime = 0;
  
  /**
   * Initialize and load the persistent dataset
   */
  async initialize(): Promise<CameraMetadataDataset> {
    if (this.isLoaded && this.dataset) {
      return this.dataset;
    }
    
    const startTime = Date.now();
    console.log('🗄️ [PERSISTENCE] Loading camera metadata dataset...');
    
    try {
      // Try to load from storage
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // Convert Map back from JSON
        const camerasMap = new Map<string, CameraMetadata>();
        if (parsed.cameras) {
          Object.entries(parsed.cameras).forEach(([id, metadata]) => {
            camerasMap.set(id, metadata as CameraMetadata);
          });
        }
        
                 this.dataset = {
           ...parsed,
           cameras: camerasMap,
           lastUpdated: new Date(parsed.lastUpdated)
         };
         
         this.loadTime = Date.now() - startTime;
         console.log(`✅ [PERSISTENCE] Loaded ${this.dataset.totalCameras} cameras in ${this.loadTime}ms`);
         console.log(`📊 [PERSISTENCE] Voronoi calculation: ${this.dataset.voronoiCalculationComplete ? 'Complete' : 'Incomplete'}`);
         
       } else {
         // Create new dataset
         this.dataset = this.createEmptyDataset();
         console.log('🆕 [PERSISTENCE] Created new camera metadata dataset');
       }
       
       this.isLoaded = true;
       return this.dataset!;
      
    } catch (error) {
      console.error('❌ [PERSISTENCE] Failed to load dataset:', error);
      
      // Try backup
      try {
        const backup = await AsyncStorage.getItem(this.BACKUP_STORAGE_KEY);
        if (backup) {
          console.log('🔄 [PERSISTENCE] Attempting to restore from backup...');
          const parsed = JSON.parse(backup);
          this.dataset = this.reconstructDataset(parsed);
          console.log('✅ [PERSISTENCE] Restored from backup');
          return this.dataset;
        }
      } catch (backupError) {
        console.error('❌ [PERSISTENCE] Backup restore failed:', backupError);
      }
      
      // Last resort: create empty dataset
      this.dataset = this.createEmptyDataset();
      return this.dataset;
    }
  }
  
     /**
    * Save dataset to persistent storage (debounced)
    */
   async saveDataset(immediate = false): Promise<void> {
     if (!this.dataset) return;
     
     // Debounce saves to avoid excessive I/O
     if (this.saveTimeout && !immediate) {
       clearTimeout(this.saveTimeout);
     }
     
     const doSave = async () => {
       if (!this.dataset) return;
       
       const startTime = Date.now();
       
       try {
         // Prepare for JSON serialization
         const serializable = {
           ...this.dataset,
           cameras: Object.fromEntries(this.dataset.cameras),
           lastUpdated: new Date().toISOString()
         };
         
         const jsonString = JSON.stringify(serializable);
         
         // Save primary
         await AsyncStorage.setItem(this.STORAGE_KEY, jsonString);
         
         // Save backup (keep previous version)
         await AsyncStorage.setItem(this.BACKUP_STORAGE_KEY, jsonString);
         
         this.saveTime = Date.now() - startTime;
         console.log(`💾 [PERSISTENCE] Dataset saved in ${this.saveTime}ms (${(jsonString.length / 1024).toFixed(1)}KB)`);
         
       } catch (error) {
         console.error('❌ [PERSISTENCE] Failed to save dataset:', error);
       }
     };
     
     if (immediate) {
       await doSave();
     } else {
       this.saveTimeout = setTimeout(doSave, 2000) as any; // 2 second debounce
     }
   }
  
  /**
   * Get or create camera metadata
   */
  async getCameraMetadata(camera: NYCCamera): Promise<CameraMetadata> {
    const dataset = await this.initialize();
    
    let metadata = dataset.cameras.get(camera.id);
    
    if (!metadata) {
      // Create new metadata entry
      metadata = {
        id: camera.id,
        camera,
        voronoiCell: {
          polygon: [],
          bounds: { north: 0, south: 0, east: 0, west: 0 },
          area: 0,
          perimeter: 0,
          neighbors: [],
          calculatedAt: new Date(),
          version: this.VERSION
        },
        analysisHistory: {
          totalAnalyses: 0,
          averageRiskScore: 5,
          riskScoreHistory: [],
          lastUpdated: new Date()
        },
        currentState: {
          analysisState: 'unanalyzed',
          isVisible: false,
          isNearUser: false
        },
        performance: {
          voronoiCalculationTime: 0,
          lastGeometryUpdate: new Date(),
          cacheHits: 0,
          cacheMisses: 0
        }
      };
      
      dataset.cameras.set(camera.id, metadata);
      dataset.totalCameras = dataset.cameras.size;
      
      // Save changes
      this.saveDataset();
    }
    
    return metadata;
  }
  
  /**
   * Update Voronoi cell data for a camera
   */
  async updateVoronoiCell(
    cameraId: string, 
    polygon: Array<{latitude: number; longitude: number}>,
    calculationTime: number
  ): Promise<void> {
    const dataset = await this.initialize();
    const metadata = dataset.cameras.get(cameraId);
    
    if (!metadata) {
      console.error(`❌ [PERSISTENCE] Camera ${cameraId} not found for Voronoi update`);
      return;
    }
    
    // Calculate bounds
    const lats = polygon.map(p => p.latitude);
    const lngs = polygon.map(p => p.longitude);
    const bounds = {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };
    
    // Calculate area (rough approximation)
    const area = this.calculatePolygonArea(polygon);
    const perimeter = this.calculatePolygonPerimeter(polygon);
    
    // Update metadata
    metadata.voronoiCell = {
      polygon,
      bounds,
      area,
      perimeter,
      neighbors: [], // Will be calculated separately
      calculatedAt: new Date(),
      version: this.VERSION
    };
    
    metadata.performance.voronoiCalculationTime = calculationTime;
    metadata.performance.lastGeometryUpdate = new Date();
    
    console.log(`📐 [PERSISTENCE] Updated Voronoi cell for ${metadata.camera.name}: ${polygon.length} vertices, ${area.toFixed(4)}km²`);
    
    // Check if all Manhattan cameras have Voronoi cells
    this.updateGlobalCompletionStatus();
    
    // Save changes
    this.saveDataset();
  }
  
  /**
   * Add analysis result to history
   */
  async addAnalysisResult(cameraId: string, riskScore: number, userId?: string, sessionId?: string): Promise<void> {
    const dataset = await this.initialize();
    const metadata = dataset.cameras.get(cameraId);
    
    if (!metadata) {
      console.error(`❌ [PERSISTENCE] Camera ${cameraId} not found for analysis update`);
      return;
    }
    
    // Add to history
    metadata.analysisHistory.riskScoreHistory.push({
      score: riskScore,
      timestamp: new Date(),
      userId,
      sessionId
    });
    
    // Update aggregated data
    metadata.analysisHistory.totalAnalyses++;
    
    // Recalculate average (weighted towards recent analyses)
    const recent = metadata.analysisHistory.riskScoreHistory.slice(-10); // Last 10 analyses
    metadata.analysisHistory.averageRiskScore = 
      recent.reduce((sum, analysis) => sum + analysis.score, 0) / recent.length;
    
    metadata.analysisHistory.lastUpdated = new Date();
    
    // Update current state
    metadata.currentState.currentRiskScore = riskScore;
    metadata.currentState.lastAnalyzed = new Date();
    metadata.currentState.analysisState = 'completed';
    
    // Update global statistics
    dataset.statistics.totalAnalyses++;
    this.updateGlobalStatistics();
    
    console.log(`📊 [PERSISTENCE] Added analysis for ${metadata.camera.name}: ${riskScore}/10 (avg: ${metadata.analysisHistory.averageRiskScore.toFixed(1)})`);
    
    // Save changes
    this.saveDataset();
  }
  
  /**
   * Get all cameras with complete Voronoi cells
   */
  async getCamerasWithVoronoi(): Promise<CameraMetadata[]> {
    const dataset = await this.initialize();
    
    return Array.from(dataset.cameras.values()).filter(metadata => 
      metadata.voronoiCell.polygon.length > 2
    );
  }
  
  /**
   * Get cameras near a location
   */
  async getCamerasNearLocation(lat: number, lng: number, radiusKm: number): Promise<CameraMetadata[]> {
    const dataset = await this.initialize();
    const nearby: CameraMetadata[] = [];
    
    for (const metadata of dataset.cameras.values()) {
      const distance = this.calculateDistance(
        lat, lng,
        metadata.camera.latitude, metadata.camera.longitude
      );
      
      if (distance <= radiusKm) {
        metadata.performance.cacheHits++;
        nearby.push(metadata);
      }
    }
    
    return nearby.sort((a, b) => {
      const distA = this.calculateDistance(lat, lng, a.camera.latitude, a.camera.longitude);
      const distB = this.calculateDistance(lat, lng, b.camera.latitude, b.camera.longitude);
      return distA - distB;
    });
  }
  
  /**
   * Export dataset for sharing/backup
   */
  async exportDataset(): Promise<string> {
    const dataset = await this.initialize();
    
    const exportData = {
      ...dataset,
      cameras: Object.fromEntries(dataset.cameras),
      exportedAt: new Date().toISOString(),
      exportVersion: this.VERSION
    };
    
    return JSON.stringify(exportData, null, 2);
  }
  
  /**
   * Import dataset from external source
   */
  async importDataset(jsonData: string, merge = true): Promise<void> {
    try {
      const importedData = JSON.parse(jsonData);
      
      if (merge && this.dataset) {
        // Merge with existing data
        console.log('🔄 [PERSISTENCE] Merging imported dataset...');
        
        for (const [id, metadata] of Object.entries(importedData.cameras)) {
          const existing = this.dataset.cameras.get(id);
          
          if (existing) {
            // Merge analysis histories
            const importedMetadata = metadata as CameraMetadata;
            existing.analysisHistory.riskScoreHistory.push(
              ...importedMetadata.analysisHistory.riskScoreHistory
            );
            
            // Update Voronoi if imported version is newer
            if (importedMetadata.voronoiCell.calculatedAt > existing.voronoiCell.calculatedAt) {
              existing.voronoiCell = importedMetadata.voronoiCell;
            }
          } else {
            this.dataset.cameras.set(id, metadata as CameraMetadata);
          }
        }
        
      } else {
        // Replace entire dataset
        console.log('🔄 [PERSISTENCE] Replacing dataset...');
        this.dataset = this.reconstructDataset(importedData);
      }
      
      this.updateGlobalStatistics();
      await this.saveDataset(true);
      
      console.log('✅ [PERSISTENCE] Dataset imported successfully');
      
    } catch (error) {
      console.error('❌ [PERSISTENCE] Failed to import dataset:', error);
      throw error;
    }
  }
  
  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      loadTime: this.loadTime,
      saveTime: this.saveTime,
      isLoaded: this.isLoaded,
      datasetSize: this.dataset?.cameras.size || 0,
      voronoiComplete: this.dataset?.voronoiCalculationComplete || false,
      totalAnalyses: this.dataset?.statistics.totalAnalyses || 0
    };
  }
  
  // Private helper methods
  
  private createEmptyDataset(): CameraMetadataDataset {
    return {
      version: this.VERSION,
      lastUpdated: new Date(),
      totalCameras: 0,
      manhattanCameras: 0,
      voronoiCalculationComplete: false,
      cameras: new Map(),
      statistics: {
        totalAnalyses: 0,
        averageRiskScore: 5,
        mostAnalyzedCamera: '',
        safestArea: '',
        riskiestArea: '',
        lastGlobalUpdate: new Date()
      }
    };
  }
  
  private reconstructDataset(data: any): CameraMetadataDataset {
    const camerasMap = new Map<string, CameraMetadata>();
    
    if (data.cameras) {
      Object.entries(data.cameras).forEach(([id, metadata]) => {
        camerasMap.set(id, metadata as CameraMetadata);
      });
    }
    
    return {
      ...data,
      cameras: camerasMap,
      lastUpdated: new Date(data.lastUpdated)
    };
  }
  
  private updateGlobalCompletionStatus(): void {
    if (!this.dataset) return;
    
    const totalCameras = this.dataset.cameras.size;
    const completedVoronoi = Array.from(this.dataset.cameras.values())
      .filter(metadata => metadata.voronoiCell.polygon.length > 2).length;
    
    this.dataset.voronoiCalculationComplete = completedVoronoi === totalCameras && totalCameras > 0;
    
    console.log(`📊 [PERSISTENCE] Voronoi progress: ${completedVoronoi}/${totalCameras} cameras (${((completedVoronoi/totalCameras)*100).toFixed(1)}%)`);
  }
  
  private updateGlobalStatistics(): void {
    if (!this.dataset) return;
    
    const allMetadata = Array.from(this.dataset.cameras.values());
    
    // Find most analyzed camera
    let mostAnalyzed = '';
    let maxAnalyses = 0;
    
    // Calculate global average risk score
    let totalScore = 0;
    let totalAnalyses = 0;
    
    for (const metadata of allMetadata) {
      if (metadata.analysisHistory.totalAnalyses > maxAnalyses) {
        maxAnalyses = metadata.analysisHistory.totalAnalyses;
        mostAnalyzed = metadata.camera.name;
      }
      
      totalScore += metadata.analysisHistory.averageRiskScore * metadata.analysisHistory.totalAnalyses;
      totalAnalyses += metadata.analysisHistory.totalAnalyses;
    }
    
    this.dataset.statistics = {
      totalAnalyses,
      averageRiskScore: totalAnalyses > 0 ? totalScore / totalAnalyses : 5,
      mostAnalyzedCamera: mostAnalyzed,
      safestArea: '', // TODO: Implement area-based statistics
      riskiestArea: '', // TODO: Implement area-based statistics
      lastGlobalUpdate: new Date()
    };
  }
  
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  private calculatePolygonArea(polygon: Array<{latitude: number; longitude: number}>): number {
    if (polygon.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      area += polygon[i].latitude * polygon[j].longitude;
      area -= polygon[j].latitude * polygon[i].longitude;
    }
    
    return Math.abs(area) / 2 * 12400; // Rough conversion to km²
  }
  
  private calculatePolygonPerimeter(polygon: Array<{latitude: number; longitude: number}>): number {
    if (polygon.length < 2) return 0;
    
    let perimeter = 0;
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      perimeter += this.calculateDistance(
        polygon[i].latitude, polygon[i].longitude,
        polygon[j].latitude, polygon[j].longitude
      );
    }
    
    return perimeter;
  }
}

// Singleton instance
const asyncStorageService = new AsyncStorageService();
export default asyncStorageService; 