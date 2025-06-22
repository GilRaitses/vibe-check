import React, { useState, useEffect, useCallback } from 'react'; 
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Modal,
  Image,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { useSafety } from '@/components/SafetyContext';
import NYCCameraService, { NYCCamera, CameraCluster, HeatMapData as ServiceHeatMapData, CameraTerritory } from '@/services/nycCameraService';
import MapView, { Marker, Region, Polygon } from 'react-native-maps';
import AnalysisProgressModal from '@/components/AnalysisProgressModal';
import { AnalysisProgress } from '@/services/moondreamService';

interface HeatMapData {
  id: string;
  coordinates: Array<{latitude: number; longitude: number}>;
  riskScore: number;
  color: string;
  opacity: number;
  analysisState?: 'unanalyzed' | 'queued' | 'analyzing' | 'completed' | 'error';
}

export default function LiveMapScreen() {
  const { blocks } = useSafety();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [apiConnected, setApiConnected] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<any>(null);
  
  // Camera clustering state
  const [currentZoom, setCurrentZoom] = useState(2);
  const [clusters, setClusters] = useState<CameraCluster[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<NYCCamera | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [autoAnalyzeEnabled, setAutoAnalyzeEnabled] = useState(true); // Auto-start enabled by default
  
  // Heat map state
  const [heatMapData, setHeatMapData] = useState<HeatMapData[]>([]);
  const [showHeatMap, setShowHeatMap] = useState(true); // Heat map enabled by default
  
  // Manhattan territory state
  const [territoryData, setTerritoryData] = useState<HeatMapData[]>([]);
  const [showTerritories, setShowTerritories] = useState(true);
  const [territoriesLoaded, setTerritoriesLoaded] = useState(false);
  
  // Progressive analysis state
  const [isProgressiveAnalyzing, setIsProgressiveAnalyzing] = useState(false);
  const [progressiveProgress, setProgressiveProgress] = useState({ current: 0, total: 0 });
  
  // Detailed progress tracking state
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  
  // Settings state (should be synced with settings screen)
  const [appSettings, setAppSettings] = useState({
    disableTimeouts: false,
    detailedProgress: true,
  });
  
  // Auto-analysis state
  const [autoAnalysisQueue, setAutoAnalysisQueue] = useState<NYCCamera[]>([]);
  const [currentAutoAnalysis, setCurrentAutoAnalysis] = useState<NYCCamera | null>(null);
  const [autoAnalysisProgress, setAutoAnalysisProgress] = useState({ current: 0, total: 0 });
  const [isAutoAnalyzing, setIsAutoAnalyzing] = useState(false);
  
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 40.7128,
    longitude: -74.0060,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    initializeApp();
    
    // Set up interval to refresh heat map data every 30 seconds
    const heatMapInterval = setInterval(() => {
      loadHeatMapData();
      loadTerritoryData();
    }, 30000);
    
    return () => {
      clearInterval(heatMapInterval);
      // Clean up region change timeout
      if (regionChangeTimeout) {
        clearTimeout(regionChangeTimeout);
      }
    };
  }, []);

  const loadHeatMapData = () => {
    try {
      const heatData: ServiceHeatMapData[] = NYCCameraService.getHeatMapData();
      console.log(`🔥 [HACKATHON] Loaded ${heatData.length} heat map regions from service`);
      
      if (heatData.length === 0) {
        console.log(`⚠️ [HACKATHON] No heat map data available - cameras need to be analyzed first`);
        setHeatMapData([]);
        return;
      }

      // Convert service heat map data to our polygon format
      const polygonData: HeatMapData[] = heatData.map((region, index) => {
        const polygon = {
          id: region.id,
          coordinates: [
            { latitude: region.bounds.south, longitude: region.bounds.west },
            { latitude: region.bounds.south, longitude: region.bounds.east },
            { latitude: region.bounds.north, longitude: region.bounds.east },
            { latitude: region.bounds.north, longitude: region.bounds.west },
          ],
          riskScore: region.riskScore,
          color: getHeatMapColor(region.riskScore),
          opacity: 0.4,
          analysisState: region.analysisState,
        };
        
        if (index === 0) {
          console.log(`🔥 [HACKATHON] Sample polygon conversion:`, {
            originalBounds: region.bounds,
            polygonCoords: polygon.coordinates,
            color: polygon.color,
            riskScore: polygon.riskScore
          });
        }
        
        return polygon;
      });
      
      console.log(`🔥 [HACKATHON] Converted to ${polygonData.length} polygon regions for map display`);
      setHeatMapData(polygonData);
      
    } catch (error) {
      console.error('❌ [HACKATHON] Failed to load heat map data:', error);
    }
  };

  const loadTerritoryData = async () => {
    try {
      if (!territoriesLoaded) {
        console.log(`🏢 [HACKATHON] Loading Manhattan territories...`);
        await NYCCameraService.generateManhattanTerritories();
        setTerritoriesLoaded(true);
      }

      const allTerritoryData = NYCCameraService.getTerritoryHeatMapData();
      console.log(`🏢 [HACKATHON] Loaded ${allTerritoryData.length} Manhattan territories`);

      // Filter territories based on user location and processing state
      let filteredTerritories = allTerritoryData;
      
      if (userLocation) {
        const userLat = userLocation.coords.latitude;
        const userLng = userLocation.coords.longitude;
        const SAFETY_BUBBLE_RADIUS = 0.5; // 500m radius

        // Separate territories into different categories
        const nearbyTerritories = allTerritoryData.filter(territory => {
          const centerLat = (territory.bounds.north + territory.bounds.south) / 2;
          const centerLng = (territory.bounds.east + territory.bounds.west) / 2;
          const distance = calculateDistance(userLat, userLng, centerLat, centerLng);
          return distance <= SAFETY_BUBBLE_RADIUS;
        });

        const adjacentTerritories = allTerritoryData.filter(territory => {
          const centerLat = (territory.bounds.north + territory.bounds.south) / 2;
          const centerLng = (territory.bounds.east + territory.bounds.west) / 2;
          const distance = calculateDistance(userLat, userLng, centerLat, centerLng);
          return distance > SAFETY_BUBBLE_RADIUS && distance <= SAFETY_BUBBLE_RADIUS * 2;
        });

        console.log(`🔮 [HACKATHON] User-based filtering: ${nearbyTerritories.length} nearby, ${adjacentTerritories.length} adjacent territories`);
        filteredTerritories = [...nearbyTerritories, ...adjacentTerritories];
      }

      // Convert territory data to polygon format with proper visual states
      const territoryPolygons: HeatMapData[] = await Promise.all(filteredTerritories.map(async territory => {
        let color = territory.color;
        let opacity = getOpacityForState(territory.analysisState);
        
        // Get the actual Voronoi polygon coordinates from the territory
        const allTerritories = await NYCCameraService.getManhattanTerritories();
        const fullTerritory = allTerritories.find(t => t.id === territory.id.replace('territory_', ''));
        
        // Use actual Voronoi polygon if available, otherwise fall back to rectangular bounds
        let coordinates;
        if (fullTerritory && fullTerritory.polygon && fullTerritory.polygon.length > 2) {
          coordinates = fullTerritory.polygon;
          console.log(`🔮 [HACKATHON] Using Voronoi polygon for ${territory.id} with ${coordinates.length} vertices`);
        } else {
          // Fallback to rectangular bounds
          coordinates = [
            { latitude: territory.bounds.south, longitude: territory.bounds.west },
            { latitude: territory.bounds.south, longitude: territory.bounds.east },
            { latitude: territory.bounds.north, longitude: territory.bounds.east },
            { latitude: territory.bounds.north, longitude: territory.bounds.west },
          ];
          console.log(`⚠️ [HACKATHON] Using rectangular fallback for ${territory.id}`);
        }
        
        // Apply visual state logic based on user proximity and processing state
        if (userLocation) {
          const centerLat = (territory.bounds.north + territory.bounds.south) / 2;
          const centerLng = (territory.bounds.east + territory.bounds.west) / 2;
          const distance = calculateDistance(
            userLocation.coords.latitude, 
            userLocation.coords.longitude, 
            centerLat, 
            centerLng
          );
          
          if (distance <= 0.5) { // Within safety bubble
            if (territory.analysisState === 'queued') {
              color = '#FFB6C1'; // Sakura pink for queued
              opacity = 0.6;
            } else if (territory.analysisState === 'analyzing') {
              color = '#FFB6C1'; // Blinking sakura pink (will be handled by animation)
              opacity = 0.8;
            }
          } else if (distance <= 1.0) { // Adjacent/tangential areas
            opacity = 0.2; // Clear and slightly blurry
            color = territory.color + '33'; // Very transparent
          }
        }

        return {
          id: territory.id,
          coordinates,
          riskScore: territory.riskScore,
          color,
          opacity,
          analysisState: territory.analysisState,
        };
      }));

      setTerritoryData(territoryPolygons);
      
    } catch (error) {
      console.error('❌ [HACKATHON] Failed to load territory data:', error);
    }
  };

  // Helper function to calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getOpacityForState = (state: 'unanalyzed' | 'queued' | 'analyzing' | 'completed' | 'error'): number => {
    switch (state) {
      case 'unanalyzed': return 0.2;
      case 'queued': return 0.3;
      case 'analyzing': return 0.4;
      case 'completed': return 0.4;
      case 'error': return 0.3;
      default: return 0.2;
    }
  };

  // Get heat map color based on risk score
  const getHeatMapColor = (riskScore: number): string => {
    if (riskScore >= 8) return '#34C759'; // Green - Safe
    if (riskScore >= 6) return '#FFCC00'; // Yellow - Moderate
    if (riskScore >= 4) return '#FF9500'; // Orange - Caution
    return '#FF3B30'; // Red - High Risk
  };

  const initializeApp = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Initialize location
      await initializeLocation();
      
      // Test API connection (don't load all cameras)
      await testAPIConnection();
      
      // Load initial camera clusters
      await loadCameraClusters(currentZoom);
      
      // Load initial heat map data
      loadHeatMapData();
      
      // Load Manhattan territories
      await loadTerritoryData();

    } catch (err) {
      console.error('❌ [HACKATHON] Error initializing app:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize app');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission is required for safety analysis');
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
      console.log(`📍 [HACKATHON] User location: ${location.coords.latitude}, ${location.coords.longitude}`);
    } catch (error) {
      console.error('📍 [HACKATHON] Location error:', error);
      throw error;
    }
  };

  const testAPIConnection = async () => {
    try {
      console.log(`🔗 [HACKATHON] Testing NYC Camera API connection...`);
      // Just test if we can reach the API without loading all data
      const testCameras = await NYCCameraService.fetchCameras(); // Test API connection
      setApiConnected(true);
      console.log(`✅ [HACKATHON] NYC Camera API connected successfully (${testCameras.length} test cameras)`);
    } catch (err) {
      console.error('❌ [HACKATHON] API connection failed:', err);
      throw new Error('Could not connect to NYC Camera API');
    }
  };

  const loadCameraClusters = async (zoomLevel: number) => {
    try {
      console.log(`🗺️ [HACKATHON] Loading camera clusters for zoom level ${zoomLevel}`);
      const newClusters = await NYCCameraService.getCameraClusters(zoomLevel);
      setClusters(newClusters);
      console.log(`✅ [HACKATHON] Loaded ${newClusters.length} camera clusters`);
    } catch (error) {
      console.error('❌ [HACKATHON] Failed to load camera clusters:', error);
    }
  };

  const loadCameraClustersForRegion = async (zoomLevel: number, bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => {
    try {
      console.log(`🗺️ [HACKATHON] Loading camera clusters for zoom level ${zoomLevel} in region:`, bounds);
      const newClusters = await NYCCameraService.getCameraClusters(zoomLevel, bounds);
      setClusters(newClusters);
      setCurrentZoom(zoomLevel);
      console.log(`✅ [HACKATHON] Loaded ${newClusters.length} camera clusters for visible region`);
    } catch (error) {
      console.error('❌ [HACKATHON] Failed to load camera clusters for region:', error);
    }
  };

  const handleZoomChange = useCallback((newZoom: number) => {
    if (newZoom !== currentZoom) {
      setCurrentZoom(newZoom);
      loadCameraClusters(newZoom);
    }
  }, [currentZoom]);

  const [regionChangeTimeout, setRegionChangeTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleRegionChange = (region: Region) => {
    setMapRegion(region);
    
    // Clear previous timeout to debounce rapid region changes
    if (regionChangeTimeout) {
      clearTimeout(regionChangeTimeout);
    }
    
    // Debounce region changes to prevent crashes during rapid zooming
    const timeout = setTimeout(() => {
      try {
        // Calculate zoom level from latitude delta
        const zoomLevel = Math.max(1, Math.min(5, Math.round(5 - Math.log2(region.latitudeDelta * 100))));
        
        // Prevent loading too many cameras when zoomed out
        if (region.latitudeDelta > 0.5) {
          console.log('🗺️ [HACKATHON] Zoomed out too far, keeping existing clusters to prevent blanking');
          // Don't clear clusters - keep existing ones to prevent map blanking
          return;
        }
        
        console.log(`🗺️ [HACKATHON] Region changed - zoom level ${zoomLevel}, delta ${region.latitudeDelta.toFixed(4)}`);
        
        // Load cameras only for the visible region
        loadCameraClustersForRegion(zoomLevel, {
          north: region.latitude + region.latitudeDelta / 2,
          south: region.latitude - region.latitudeDelta / 2,
          east: region.longitude + region.longitudeDelta / 2,
          west: region.longitude - region.longitudeDelta / 2
        });
        
        // Refresh heat map when region changes (less frequently)
        loadHeatMapData();
      } catch (error) {
        console.error('❌ [HACKATHON] Error in handleRegionChange:', error);
      }
    }, 500); // 500ms debounce
    
    setRegionChangeTimeout(timeout as any);
  };

  const handleClusterPress = (cluster: CameraCluster) => {
    if (cluster.cameraCount === 1) {
      // Single camera - show directly
      setSelectedCamera(cluster.cameras[0]);
      setShowCameraModal(true);
    } else {
      // Multiple cameras - show selection modal with batch analysis option
      const buttons = cluster.cameras.map(camera => ({
        text: camera.name,
        onPress: () => {
          setSelectedCamera(camera);
          setShowCameraModal(true);
        }
      }));
      
      // Add batch analysis option
      buttons.unshift({
        text: `🎯 Analyze All ${cluster.cameraCount} Cameras`,
        onPress: () => analyzeCameraBatch(cluster.cameras)
      });
      
      buttons.push({ text: 'Cancel', onPress: () => {} });
      
      Alert.alert(
        `${cluster.region} - ${cluster.cameraCount} Cameras`,
        'Select an option:',
        buttons
      );
    }
  };

  const handleCameraPress = (camera: NYCCamera) => {
    setSelectedCamera(camera);
    setShowCameraModal(true);
  };

  // Progress callback for detailed analysis tracking
  const handleAnalysisProgress = (progress: AnalysisProgress) => {
    setAnalysisProgress(progress);
    
    if (appSettings.detailedProgress && !isAutoAnalyzing) {
      if (!showProgressModal && !progress.completed) {
        setShowProgressModal(true);
      }
      
      if (progress.completed || progress.error) {
        // Keep modal open for 2 seconds to show completion
        setTimeout(() => {
          setShowProgressModal(false);
          setAnalysisProgress(null);
        }, 2000);
      }
    }
  };

  // Auto-analysis functionality
  const startAutoAnalysis = async () => {
    if (isAutoAnalyzing || !userLocation) return;
    
    console.log('🤖 [HACKATHON] Starting auto-analysis of nearby cameras...');
    setIsAutoAnalyzing(true);
    
    try {
      // Get cameras near user location (within 2km)
      const nearbyCameras = await NYCCameraService.getCamerasNearLocation(
        userLocation.coords.latitude,
        userLocation.coords.longitude,
        2 // 2km radius
      );
      
      console.log(`🤖 [HACKATHON] Found ${nearbyCameras.length} cameras for auto-analysis`);
      
      // Limit to 10 cameras for reasonable analysis time
      const camerasToAnalyze = nearbyCameras.slice(0, 10);
      setAutoAnalysisQueue(camerasToAnalyze);
      setAutoAnalysisProgress({ current: 0, total: camerasToAnalyze.length });
      
      // Mark cameras as queued in territories
      for (const camera of camerasToAnalyze) {
        NYCCameraService.updateTerritoryState(camera.id, 'queued');
      }
      loadTerritoryData(); // Refresh to show queued state
      
      // Start analyzing cameras one by one
      for (let i = 0; i < camerasToAnalyze.length; i++) {
        const camera = camerasToAnalyze[i];
        setCurrentAutoAnalysis(camera);
        setAutoAnalysisProgress({ current: i + 1, total: camerasToAnalyze.length });
        
        console.log(`🤖 [HACKATHON] Auto-analyzing camera ${i + 1}/${camerasToAnalyze.length}: ${camera.name}`);
        
        try {
          // Mark as analyzing
          NYCCameraService.updateTerritoryState(camera.id, 'analyzing');
          loadTerritoryData(); // Refresh to show analyzing state
          
          const analysis = await NYCCameraService.analyzeCameraRisk(
            camera,
            undefined, // No progress callback for auto-analysis
            appSettings.disableTimeouts
          );
          
          // Mark as completed with risk score
          NYCCameraService.updateTerritoryState(camera.id, 'completed', analysis.riskScore);
          
          setLastAnalysis({ camera, analysis });
          
          // Update heat map and territories
          loadHeatMapData();
          loadTerritoryData();
          
          // Wait 3 seconds between analyses to be respectful to API
          if (i < camerasToAnalyze.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          
        } catch (error) {
          console.error(`❌ [HACKATHON] Auto-analysis failed for camera ${camera.name}:`, error);
          // Mark as error
          NYCCameraService.updateTerritoryState(camera.id, 'error');
          loadTerritoryData();
          // Continue with next camera even if this one fails
        }
      }
      
      console.log('✅ [HACKATHON] Auto-analysis completed');
      
    } catch (error) {
      console.error('❌ [HACKATHON] Auto-analysis failed:', error);
    } finally {
      setIsAutoAnalyzing(false);
      setCurrentAutoAnalysis(null);
      setAutoAnalysisQueue([]);
      setAutoAnalysisProgress({ current: 0, total: 0 });
    }
  };

  // Start auto-analysis when enabled
  useEffect(() => {
    if (autoAnalyzeEnabled && userLocation && apiConnected && !isAutoAnalyzing && territoriesLoaded) {
      startAutoAnalysis();
    }
  }, [autoAnalyzeEnabled, userLocation, apiConnected, territoriesLoaded]);

  const analyzeSpecificCamera = async (camera: NYCCamera) => {
    try {
      setIsAnalyzing(true);
      console.log(`🎯 [HACKATHON] Analyzing specific camera: ${camera.name}`);
      console.log(`🎯 [HACKATHON] Camera location: ${camera.latitude}, ${camera.longitude}`);

      // Mark territory as analyzing
      NYCCameraService.updateTerritoryState(camera.id, 'analyzing');
      loadTerritoryData();

      const analysis = await NYCCameraService.analyzeCameraRisk(
        camera, 
        appSettings.detailedProgress ? handleAnalysisProgress : undefined,
        appSettings.disableTimeouts
      );
      console.log(`✅ [HACKATHON] Analysis completed for ${camera.name}:`, analysis);
      
      // Mark territory as completed
      NYCCameraService.updateTerritoryState(camera.id, 'completed', analysis.riskScore);
      
      setLastAnalysis({ camera, analysis });

      // Refresh heat map data and territories after analysis
      loadHeatMapData();
      loadTerritoryData();

      Alert.alert(
        'Analysis Complete',
        `Camera: ${camera.name}\n` +
        `Location: ${camera.area}\n` +
        `Risk Score: ${analysis.riskScore}/10\n` +
        `Active Cyclists: ${analysis.bikeCount}\n` +
        `Scene: ${analysis.sceneDescription}\n\n` +
        `🔥 Heat Map: ${heatMapData.length} regions loaded\n` +
        `🏢 Territories: ${territoryData.length} areas mapped`,
        [
          { 
            text: 'Show Territory Debug', 
            onPress: () => {
              const heatData = NYCCameraService.getHeatMapData();
              const territoryData = NYCCameraService.getTerritoryHeatMapData();
              Alert.alert('Territory Debug', 
                `Heat Map: ${heatData.length} regions\n` +
                `Territories: ${territoryData.length} areas\n` +
                `Manhattan Coverage: ${territoryData.filter(t => t.analysisState === 'completed').length} analyzed`
              );
            }
          },
          { text: 'OK' }
        ]
      );

    } catch (error) {
      console.error('❌ [HACKATHON] Analysis failed:', error);
      // Mark territory as error
      NYCCameraService.updateTerritoryState(camera.id, 'error');
      loadTerritoryData();
      Alert.alert('Analysis Failed', 'Could not analyze camera');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeNearestCamera = async () => {
    if (!userLocation) {
      Alert.alert('Location Required', 'Please enable location to find nearest camera');
      return;
    }

    try {
      setIsAnalyzing(true);
      console.log(`🎯 [HACKATHON] Finding nearest camera to user location...`);

      // Get cameras near user location
      const nearbyCameras = await NYCCameraService.getCamerasNearLocation(
        userLocation.coords.latitude,
        userLocation.coords.longitude,
        1 // Only get 1 nearest camera
      );

      if (nearbyCameras.length === 0) {
        Alert.alert('No Cameras Found', 'No NYC traffic cameras found in your area');
        return;
      }

      const nearestCamera = nearbyCameras[0];
      console.log(`📸 [HACKATHON] Analyzing nearest camera: ${nearestCamera.name}`);

      // Analyze the nearest camera
      const analysis = await NYCCameraService.analyzeCameraRisk(
        nearestCamera,
        appSettings.detailedProgress ? handleAnalysisProgress : undefined,
        appSettings.disableTimeouts
      );
      setLastAnalysis({ camera: nearestCamera, analysis });

      // Refresh heat map data after analysis
      loadHeatMapData();

      Alert.alert(
        'Analysis Complete',
        `Nearest Camera: ${nearestCamera.name}\n` +
        `Location: ${nearestCamera.area}\n` +
        `Risk Score: ${analysis.riskScore}/10\n` +
        `Active Cyclists: ${analysis.bikeCount}\n` +
        `Scene: ${analysis.sceneDescription}`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('❌ [HACKATHON] Analysis failed:', error);
      Alert.alert('Analysis Failed', 'Could not analyze nearest camera');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeCameraBatch = async (cameras: any[]) => {
    if (cameras.length === 0) return;
    
    setIsAnalyzing(true);
    try {
      console.log(`🎯 [HACKATHON] Starting batch analysis of ${cameras.length} cameras`);
      
      // Analyze all cameras in the batch
      const batchResults = [];
      for (const camera of cameras) {
        try {
          const result = await NYCCameraService.analyzeCameraRisk(camera);
          batchResults.push({ camera, analysis: result });
        } catch (error) {
          console.error(`❌ [HACKATHON] Failed to analyze camera ${camera.name}:`, error);
        }
      }
      
      if (batchResults.length > 0) {
        // Calculate composite metrics
        const avgRiskScore = Math.round(
          batchResults.reduce((sum, r) => sum + r.analysis.riskScore, 0) / batchResults.length
        );
        const totalBikes = batchResults.reduce((sum, r) => sum + r.analysis.bikeCount, 0);
        const totalPedestrians = batchResults.reduce((sum, r) => sum + r.analysis.pedestrianCount, 0);
        const totalTrucks = batchResults.reduce((sum, r) => sum + r.analysis.truckCount, 0);
        
        // Show batch analysis results
        Alert.alert(
          `Batch Analysis Complete`,
          `Analyzed ${batchResults.length} cameras:\n\n` +
          `🚨 Average Risk Score: ${avgRiskScore}/10\n` +
          `🚴 Total Active Cyclists: ${totalBikes}\n` +
          `🚶 Total Pedestrians: ${totalPedestrians}\n` +
          `🚛 Total Trucks: ${totalTrucks}\n\n` +
          `Individual results saved to analysis history.`,
          [{ text: 'OK', onPress: () => {} }]
        );
        
        // Store the last batch result for heat map
        setLastAnalysis(batchResults[0]); // Show first result as "latest"
        
        // Refresh heat map data after batch analysis
        loadHeatMapData();
      } else {
        Alert.alert('Analysis Failed', 'Could not analyze any cameras in this batch.');
      }
    } catch (error) {
      console.error('❌ [HACKATHON] Failed to analyze camera batch:', error);
      Alert.alert('Batch Analysis Failed', 'Failed to analyze camera batch. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeAreaProgressively = async () => {
    if (!userLocation) {
      Alert.alert('Location Required', 'Please enable location to analyze area');
      return;
    }

    try {
      setIsProgressiveAnalyzing(true);
      console.log(`🗺️ [HACKATHON] Starting progressive area analysis...`);

      // Get cameras in expanding radius around user location
      const radiusSteps = [0.2, 0.5, 1.0]; // km - start small and expand
      let allCameras: NYCCamera[] = [];
      
      for (const radius of radiusSteps) {
        const cameras = await NYCCameraService.getCamerasNearLocation(
          userLocation.coords.latitude,
          userLocation.coords.longitude,
          radius
        );
        
        // Only add new cameras not already analyzed
        const newCameras = cameras.filter(cam => 
          !allCameras.some(existing => existing.id === cam.id)
        );
        
        allCameras.push(...newCameras);
        console.log(`📍 [HACKATHON] Found ${cameras.length} cameras within ${radius}km (${newCameras.length} new)`);
      }

      if (allCameras.length === 0) {
        Alert.alert('No Cameras Found', 'No cameras found in your area for progressive analysis');
        return;
      }

      // Limit to prevent overwhelming the API
      const camerasToAnalyze = allCameras.slice(0, 10);
      setProgressiveProgress({ current: 0, total: camerasToAnalyze.length });

      console.log(`🎯 [HACKATHON] Starting progressive analysis of ${camerasToAnalyze.length} cameras`);

      const results = [];
      for (let i = 0; i < camerasToAnalyze.length; i++) {
        const camera = camerasToAnalyze[i];
        
        try {
          console.log(`📸 [HACKATHON] Progressive analysis ${i + 1}/${camerasToAnalyze.length}: ${camera.name}`);
          setProgressiveProgress({ current: i + 1, total: camerasToAnalyze.length });
          
          const analysis = await NYCCameraService.analyzeCameraRisk(camera);
          results.push({ camera, analysis });
          
          // Refresh heat map after each analysis to show progressive filling
          loadHeatMapData();
          
          // Small delay to prevent overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`❌ [HACKATHON] Failed to analyze camera ${camera.name}:`, error);
        }
      }

      // Final results
      const avgRiskScore = results.length > 0 
        ? Math.round(results.reduce((sum, r) => sum + r.analysis.riskScore, 0) / results.length)
        : 0;
      
      const totalCyclists = results.reduce((sum, r) => sum + r.analysis.bikeCount, 0);

      Alert.alert(
        'Progressive Analysis Complete',
        `Analyzed ${results.length}/${camerasToAnalyze.length} cameras in your area:\n\n` +
        `🗺️ Average Risk Score: ${avgRiskScore}/10\n` +
        `🚴 Total Active Cyclists: ${totalCyclists}\n` +
        `🔥 Heat map filled progressively\n\n` +
        `Check the heat map to see the analyzed area coverage!`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('❌ [HACKATHON] Progressive analysis failed:', error);
      Alert.alert('Progressive Analysis Failed', 'Could not complete area analysis');
    } finally {
      setIsProgressiveAnalyzing(false);
      setProgressiveProgress({ current: 0, total: 0 });
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Initializing NYC Safety Analysis...</Text>
          <Text style={styles.loadingSubtext}>
            • Getting your location{'\n'}
            • Connecting to NYC Camera API{'\n'}
            • Preparing AI analysis system
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={initializeApp}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Clean Map View */}
      <MapView 
        style={styles.map}
        region={mapRegion}
        onRegionChangeComplete={handleRegionChange}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {/* Manhattan Territory Polygons (show first, underneath other layers) */}
        {showTerritories && territoryData.map((territory) => (
          <Polygon
            key={territory.id}
            coordinates={territory.coordinates}
            fillColor={`${territory.color}${Math.round(territory.opacity * 255).toString(16).padStart(2, '0')}`}
            strokeColor={territory.color}
            strokeWidth={1}
          />
        ))}

        {/* Heat Map Polygons (show on top of territories) */}
        {showHeatMap && heatMapData.map((heatData) => (
          <Polygon
            key={heatData.id}
            coordinates={heatData.coordinates}
            fillColor={`${heatData.color}66`}
            strokeColor={heatData.color}
            strokeWidth={2}
          />
        ))}

        {/* Camera Clusters */}
        {clusters.map((cluster) => (
          <Marker
            key={cluster.id}
            coordinate={{
              latitude: cluster.latitude,
              longitude: cluster.longitude,
            }}
            title={`${cluster.region} - ${cluster.cameraCount} Camera${cluster.cameraCount > 1 ? 's' : ''}`}
            description={`Tap to view camera${cluster.cameraCount > 1 ? 's' : ''}`}
            onPress={() => handleClusterPress(cluster)}
          >
            <View style={styles.clusterMarker}>
              <Text style={styles.clusterText}>{cluster.cameraCount}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Status Overlay with Territory Info */}
      <View style={styles.statusOverlay}>
        <Text style={styles.statusTitle}>🗽 NYC Safety Analysis</Text>
        <Text style={styles.statusSubtitle}>
          {apiConnected ? `✅ ${clusters.length} Camera Groups` : '⚠️ API Disconnected'}
        </Text>
        <Text style={styles.statusSubtitle}>
          🔥 Heat Map: {heatMapData.length} risk areas {showHeatMap ? '(visible)' : '(hidden)'}
        </Text>
        <Text style={styles.statusSubtitle}>
          🏢 Manhattan: {territoryData.length} territories ({territoryData.filter(t => t.analysisState === 'completed').length} analyzed)
        </Text>
        {userLocation && (
          <Text style={styles.locationText}>
            📍 Zoom: {currentZoom} | {userLocation.coords.latitude.toFixed(4)}, {userLocation.coords.longitude.toFixed(4)}
          </Text>
        )}
      </View>

      {/* Manual Analyze Buttons (only show if auto-analyze is disabled and not auto-analyzing) */}
      {!autoAnalyzeEnabled && !isAutoAnalyzing && (
        <View style={styles.analyzeButtonContainer}>
          <TouchableOpacity 
            style={[styles.analyzeButton, { opacity: isAnalyzing || isProgressiveAnalyzing ? 0.7 : 1 }]}
            onPress={analyzeNearestCamera}
            disabled={isAnalyzing || isProgressiveAnalyzing || !apiConnected || !userLocation}
          >
            {isAnalyzing ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.analyzeButtonText}>Analyzing...</Text>
              </View>
            ) : (
              <Text style={styles.analyzeButtonText}>
                🎯 Analyze Nearest
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.progressiveButton, { opacity: isAnalyzing || isProgressiveAnalyzing ? 0.7 : 1 }]}
            onPress={analyzeAreaProgressively}
            disabled={isAnalyzing || isProgressiveAnalyzing || !apiConnected || !userLocation}
          >
            {isProgressiveAnalyzing ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.progressiveButtonText}>
                  Area... {progressiveProgress.current}/{progressiveProgress.total}
                </Text>
              </View>
            ) : (
              <Text style={styles.progressiveButtonText}>
                🗺️ Analyze Area
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Settings Toggles */}
      <View style={styles.settingsOverlay}>
        <TouchableOpacity 
          style={styles.toggleButton}
          onPress={() => setAutoAnalyzeEnabled(!autoAnalyzeEnabled)}
        >
          <Text style={styles.toggleButtonText}>
            {autoAnalyzeEnabled ? '🔄' : '⏸️'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleButton, { marginTop: 8 }]}
          onPress={() => setShowHeatMap(!showHeatMap)}
        >
          <Text style={styles.toggleButtonText}>
            🔥
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleButton, { marginTop: 8, backgroundColor: showTerritories ? '#34C759' : '#666666' }]}
          onPress={() => setShowTerritories(!showTerritories)}
        >
          <Text style={styles.toggleButtonText}>
            🏢
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleButton, { marginTop: 8, backgroundColor: appSettings.detailedProgress ? '#34C759' : '#666666' }]}
          onPress={() => setAppSettings(prev => ({
            ...prev,
            detailedProgress: !prev.detailedProgress
          }))}
        >
          <Text style={styles.toggleButtonText}>
            📊
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleButton, { marginTop: 8, backgroundColor: appSettings.disableTimeouts ? '#FF9500' : '#666666' }]}
          onPress={() => setAppSettings(prev => ({
            ...prev,
            disableTimeouts: !prev.disableTimeouts
          }))}
        >
          <Text style={styles.toggleButtonText}>
            ⏰
          </Text>
        </TouchableOpacity>
      </View>

      {/* Camera Modal */}
      <Modal
        visible={showCameraModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCameraModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {selectedCamera && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedCamera.name}</Text>
                <TouchableOpacity 
                  style={styles.closeModalButton}
                  onPress={() => setShowCameraModal(false)}
                >
                  <Text style={styles.closeModalButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.modalSubtitle}>📍 {selectedCamera.area}</Text>
              
              <View style={styles.cameraImageContainer}>
        <Image
                  source={{ uri: selectedCamera.imageUrl }}
                  style={styles.cameraImage}
                  resizeMode="contain"
                />
              </View>
              
              <View style={styles.cameraInfo}>
                <Text style={styles.infoTitle}>Camera Details:</Text>
                <Text style={styles.infoText}>ID: {selectedCamera.id}</Text>
                <Text style={styles.infoText}>
                  Location: {selectedCamera.latitude.toFixed(4)}, {selectedCamera.longitude.toFixed(4)}
                </Text>
                <Text style={styles.infoText}>
                  Status: {selectedCamera.isOnline ? '🟢 Online' : '🔴 Offline'}
                </Text>
              </View>
              
              <TouchableOpacity 
                style={styles.analyzeThisCameraButton}
                onPress={() => {
                  setShowCameraModal(false);
                  analyzeSpecificCamera(selectedCamera);
                }}
              >
                <Text style={styles.analyzeThisCameraButtonText}>
                  🔍 Analyze This Camera
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Last Analysis Result */}
      {lastAnalysis && (
        <View style={styles.resultOverlay}>
          <TouchableOpacity 
            style={styles.resultCloseButton}
            onPress={() => {
              console.log('🎯 [HACKATHON] Closing latest analysis result');
              setLastAnalysis(null);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.resultCloseButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.resultTitle}>Latest Analysis</Text>
          <Text style={styles.resultText}>
            📹 {lastAnalysis.camera.name}
          </Text>
          <Text style={styles.resultText}>
            Risk: {lastAnalysis.analysis.riskScore}/10 • Cyclists: {lastAnalysis.analysis.bikeCount}
          </Text>
        </View>
      )}

      {/* Auto-Analysis Progress Bar - Moved to top area */}
      {isAutoAnalyzing && (
        <View style={styles.autoAnalysisBar}>
          <View style={styles.autoAnalysisContent}>
            <Text style={styles.autoAnalysisText}>
              🤖 {currentAutoAnalysis?.name?.substring(0, 25) || 'Loading...'}
            </Text>
            <Text style={styles.autoAnalysisProgress}>
              {autoAnalysisProgress.current}/{autoAnalysisProgress.total}
            </Text>
          </View>
          <View style={styles.autoProgressTrack}>
            <View 
              style={[
                styles.autoProgressFill,
                { 
                  width: autoAnalysisProgress.total > 0 
                    ? `${(autoAnalysisProgress.current / autoAnalysisProgress.total) * 100}%` 
                    : '0%' 
                }
              ]}
            />
          </View>
          <TouchableOpacity 
            style={styles.autoAnalysisStop}
            onPress={() => {
              console.log('🛑 [HACKATHON] Stopping auto-analysis');
              setAutoAnalyzeEnabled(false);
              setIsAutoAnalyzing(false);
              setCurrentAutoAnalysis(null);
              setAutoAnalysisQueue([]);
              setAutoAnalysisProgress({ current: 0, total: 0 });
            }}
          >
            <Text style={styles.autoAnalysisStopText}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Analysis Progress Modal */}
      <AnalysisProgressModal
        visible={showProgressModal}
        progress={analysisProgress}
        onCancel={() => {
          setShowProgressModal(false);
          setAnalysisProgress(null);
        }}
        allowCancel={!analysisProgress?.completed && !analysisProgress?.error}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  map: {
    flex: 1,
  },
  clusterMarker: {
    backgroundColor: '#007AFF',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  clusterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  settingsOverlay: {
    position: 'absolute',
    top: 120,
    right: 20,
  },
  toggleButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 25,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 20,
  },
  closeModalButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  cameraImageContainer: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 20,
  },
  cameraImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  cameraInfo: {
    backgroundColor: '#F8F8F8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  analyzeThisCameraButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  analyzeThisCameraButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultCloseButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  resultCloseButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#FFF',
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingSubtext: {
    color: '#AAA',
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    color: '#FF3B30',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  errorText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 15,
    borderRadius: 10,
  },
  statusTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statusSubtitle: {
    color: '#CCCCCC',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  locationText: {
    color: '#007AFF',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  analyzeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  analyzeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultOverlay: {
    position: 'absolute',
    bottom: 200,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 100, 0, 0.9)',
    padding: 12,
    borderRadius: 8,
  },
  resultTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginBottom: 2,
  },
  analyzeButtonContainer: {
    position: 'absolute',
    bottom: 150,
    left: 20,
    right: 20,
  },
  progressiveButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  progressiveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  autoAnalysisBar: {
    position: 'absolute',
    top: 180,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333333',
  },
  autoAnalysisContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  autoAnalysisText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  autoAnalysisProgress: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 12,
  },
  autoProgressTrack: {
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    marginBottom: 8,
  },
  autoProgressFill: {
    height: '100%',
    backgroundColor: '#4A90E2',
    borderRadius: 2,
  },
  autoAnalysisStop: {
    position: 'absolute',
    top: 8,
    right: 12,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  autoAnalysisStopText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
