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
import NYCCameraService, { NYCCamera, CameraCluster } from '@/services/nycCameraService';
import MapView, { Marker, Region } from 'react-native-maps';

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
  const [autoAnalyzeEnabled, setAutoAnalyzeEnabled] = useState(false); // Disabled by default
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 40.7128,
    longitude: -74.0060,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    initializeApp();
  }, []);

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

  const handleRegionChange = (region: Region) => {
    setMapRegion(region);
    // Calculate zoom level from latitude delta
    const zoomLevel = Math.max(1, Math.min(5, Math.round(5 - Math.log2(region.latitudeDelta * 100))));
    
    // Load cameras only for the visible region
    loadCameraClustersForRegion(zoomLevel, {
      north: region.latitude + region.latitudeDelta / 2,
      south: region.latitude - region.latitudeDelta / 2,
      east: region.longitude + region.longitudeDelta / 2,
      west: region.longitude - region.longitudeDelta / 2
    });
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

  const analyzeSpecificCamera = async (camera: NYCCamera) => {
    try {
      setIsAnalyzing(true);
      console.log(`🎯 [HACKATHON] Analyzing specific camera: ${camera.name}`);

      const analysis = await NYCCameraService.analyzeCameraRisk(camera);
      setLastAnalysis({ camera, analysis });

              Alert.alert(
          'Analysis Complete',
          `Camera: ${camera.name}\n` +
          `Location: ${camera.area}\n` +
          `Risk Score: ${analysis.riskScore}/10\n` +
          `Active Cyclists: ${analysis.bikeCount}\n` +
          `Scene: ${analysis.sceneDescription}`,
          [{ text: 'OK' }]
        );

    } catch (error) {
      console.error('❌ [HACKATHON] Analysis failed:', error);
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
      const analysis = await NYCCameraService.analyzeCameraRisk(nearestCamera);
      setLastAnalysis({ camera: nearestCamera, analysis });

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

      {/* Simple Status Overlay */}
      <View style={styles.statusOverlay}>
        <Text style={styles.statusTitle}>🗽 NYC Traffic Cameras</Text>
        <Text style={styles.statusSubtitle}>
          {apiConnected ? `✅ ${clusters.length} Camera Groups` : '⚠️ API Disconnected'}
        </Text>
        {userLocation && (
          <Text style={styles.locationText}>
            📍 Zoom: {currentZoom} | {userLocation.coords.latitude.toFixed(4)}, {userLocation.coords.longitude.toFixed(4)}
          </Text>
        )}
      </View>

      {/* Manual Analyze Button (only show if auto-analyze is disabled) */}
      {!autoAnalyzeEnabled && (
        <TouchableOpacity 
          style={[styles.analyzeButton, { opacity: isAnalyzing ? 0.7 : 1 }]}
          onPress={analyzeNearestCamera}
          disabled={isAnalyzing || !apiConnected || !userLocation}
        >
          {isAnalyzing ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.analyzeButtonText}>Analyzing...</Text>
            </View>
          ) : (
            <Text style={styles.analyzeButtonText}>
              🎯 Analyze Nearest Camera
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Settings Toggle */}
      <View style={styles.settingsOverlay}>
        <TouchableOpacity 
          style={styles.toggleButton}
          onPress={() => setAutoAnalyzeEnabled(!autoAnalyzeEnabled)}
        >
          <Text style={styles.toggleButtonText}>
            {autoAnalyzeEnabled ? '🔄 Auto-Analyze: ON' : '⏸️ Auto-Analyze: OFF'}
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
            onPress={() => setLastAnalysis(null)}
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
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
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
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
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  analyzeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultOverlay: {
    position: 'absolute',
    bottom: 100,
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
});
