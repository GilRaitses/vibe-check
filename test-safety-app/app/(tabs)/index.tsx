import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
  SafeAreaView,
  ScrollView,
  Modal,
  Image,
} from 'react-native';
import MapView, { Marker, Heatmap, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafety } from '@/components/SafetyContext';
import NYCCameraService, { NYCCamera, CameraRiskAnalysis, HeatMapRegion } from '@/services/nycCameraService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface CameraProcessingState {
  camera: NYCCamera;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  analysis?: CameraRiskAnalysis;
  startTime?: Date;
  completionTime?: Date;
}

interface MapState {
  region: Region;
  userLocation: Location.LocationObject | null;
  cameras: NYCCamera[];
  processingCameras: Map<string, CameraProcessingState>;
  heatMapData: Array<{
    latitude: number;
    longitude: number;
    weight: number;
  }>;
  isAnalyzing: boolean;
  showHeatMap: boolean;
  showDataPanel: boolean;
  showDevMode: boolean;
  selectedCameraForDev: NYCCamera | null;
  analysisProgress: string;
  completedAnalyses: CameraRiskAnalysis[];
}

export default function LiveMapScreen() {
  const { blocks } = useSafety();
  const [mapState, setMapState] = useState<MapState>({
    region: {
      latitude: 40.7589, // NYC center
      longitude: -73.9851,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    },
    userLocation: null,
    cameras: [],
    processingCameras: new Map(),
    heatMapData: [],
    isAnalyzing: false,
    showHeatMap: true,
    showDataPanel: false,
    showDevMode: false,
    selectedCameraForDev: null,
    analysisProgress: '',
    completedAnalyses: [],
  });

  useEffect(() => {
    initializeLocation();
    loadCamerasInBackground();
  }, []);

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location access is required for safety mapping.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setMapState(prev => ({
        ...prev,
        userLocation: location,
        region: {
          ...prev.region,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }
      }));

      console.log(`📍 [HACKATHON] User location loaded: ${location.coords.latitude}, ${location.coords.longitude}`);

    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const loadCamerasInBackground = async () => {
    try {
      console.log(`📹 [HACKATHON] Loading NYC camera positions...`);
      const cameras = await NYCCameraService.fetchCameras();
      console.log(`✅ [HACKATHON] Loaded ${cameras.length} camera positions for map display`);
      console.log(`🚫 [HACKATHON] NO AUTOMATIC ANALYSIS - All analysis is user-triggered only`);
      setMapState(prev => ({ ...prev, cameras }));
    } catch (error) {
      console.error('❌ [HACKATHON] Error loading cameras:', error);
    }
  };

  // Note: Removed analyzeNearbyArea function - all analysis is now on-demand via camera marker taps

  const onRegionChangeComplete = (region: Region) => {
    setMapState(prev => ({ ...prev, region }));
  };

  const onMapPress = (event: any) => {
    // Map press no longer triggers analysis - user must tap on camera markers
    console.log(`🗺️ [HACKATHON] User tapped map at: ${event.nativeEvent.coordinate.latitude}, ${event.nativeEvent.coordinate.longitude}`);
  };

  const toggleHeatMap = () => {
    setMapState(prev => ({ ...prev, showHeatMap: !prev.showHeatMap }));
  };

  const toggleDataPanel = () => {
    setMapState(prev => ({ ...prev, showDataPanel: !prev.showDataPanel }));
  };

  const toggleDevMode = () => {
    setMapState(prev => ({ ...prev, showDevMode: !prev.showDevMode }));
  };

  const analyzeSingleCamera = async (camera: NYCCamera) => {
    console.log(`🎯 [HACKATHON] User tapped on camera: ${camera.name} (${camera.area})`);
    console.log(`📸 [HACKATHON] Starting on-demand analysis for camera ${camera.id}`);
    console.log(`🔗 [HACKATHON] Camera image URL: ${camera.imageUrl}`);
    
    // Update processing state to show this camera is being analyzed
    setMapState(prev => {
      const newProcessingMap = new Map(prev.processingCameras);
      newProcessingMap.set(camera.id, {
        camera,
        status: 'analyzing',
        startTime: new Date()
      });
      return { 
        ...prev, 
        processingCameras: newProcessingMap,
        isAnalyzing: true,
        analysisProgress: `Analyzing ${camera.name} with Moondream AI...`,
        selectedCameraForDev: camera
      };
    });

    try {
      const analysis = await NYCCameraService.analyzeCameraRisk(camera);
      
      // Update processing state to completed
      setMapState(prev => {
        const newProcessingMap = new Map(prev.processingCameras);
        newProcessingMap.set(camera.id, {
          camera,
          status: 'completed',
          analysis,
          startTime: prev.processingCameras.get(camera.id)?.startTime,
          completionTime: new Date()
        });
        
        // Add to heat map
        const riskWeight = (11 - analysis.riskScore) / 10; // Convert to 0.1-1.0 scale, inverted (higher risk = higher weight)
        const newHeatMapPoint = {
          latitude: camera.latitude,
          longitude: camera.longitude,
          weight: Math.max(0.1, riskWeight) // Ensure minimum visibility
        };

        return { 
          ...prev, 
          processingCameras: newProcessingMap,
          isAnalyzing: false,
          analysisProgress: `Analysis completed for ${camera.name}`,
          completedAnalyses: [...prev.completedAnalyses, analysis],
          heatMapData: [...prev.heatMapData, newHeatMapPoint]
        };
      });
      
    } catch (error) {
      console.error(`❌ [HACKATHON] Failed to analyze camera ${camera.id}:`, error);
      
      // Update processing state to error
      setMapState(prev => {
        const newProcessingMap = new Map(prev.processingCameras);
        newProcessingMap.set(camera.id, {
          camera,
          status: 'error',
          startTime: prev.processingCameras.get(camera.id)?.startTime,
          completionTime: new Date()
        });
        
        return { 
          ...prev, 
          processingCameras: newProcessingMap,
          isAnalyzing: false,
          analysisProgress: `Analysis failed for ${camera.name}`
        };
      });
    }
  };

  const refreshAnalysis = () => {
    // Clear all previous analyses
    setMapState(prev => ({
      ...prev,
      processingCameras: new Map(),
      completedAnalyses: [],
      analysisProgress: 'Tap on any camera to analyze it with AI'
    }));
  };

  const getCameraMarkerColor = (cameraId: string): string => {
    const processingState = mapState.processingCameras.get(cameraId);
    if (!processingState) return '#CCCCCC'; // Default gray
    
    switch (processingState.status) {
      case 'pending': return '#FFA500'; // Orange
      case 'analyzing': return '#00BFFF'; // Deep sky blue
      case 'completed': return '#00FF00'; // Green
      case 'error': return '#FF0000'; // Red
      default: return '#CCCCCC';
    }
  };

  const getCameraStatusText = (cameraId: string): string => {
    const processingState = mapState.processingCameras.get(cameraId);
    if (!processingState) return 'Ready';
    
    switch (processingState.status) {
      case 'pending': return 'Queued';
      case 'analyzing': return 'Analyzing...';
      case 'completed': return `Risk: ${processingState.analysis?.riskScore}/10`;
      case 'error': return 'Failed';
      default: return 'Unknown';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🗽 NYC CCTV Safety Analysis</Text>
        <Text style={styles.subtitle}>Real-time AI processing of traffic cameras</Text>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          region={mapState.region}
          onRegionChangeComplete={onRegionChangeComplete}
          onPress={onMapPress}
          showsUserLocation={true}
          showsMyLocationButton={true}
          mapType="standard"
        >
          {/* Heat Map Overlay */}
          {mapState.showHeatMap && mapState.heatMapData.length > 0 && (
            <Heatmap
              points={mapState.heatMapData}
              radius={50}
              opacity={0.7}
              gradient={{
                colors: ['#00FF00', '#FFFF00', '#FF6600', '#FF0000'],
                startPoints: [0.1, 0.4, 0.7, 1.0],
                colorMapSize: 256
              }}
            />
          )}

          {/* Processing Camera Markers */}
          {Array.from(mapState.processingCameras.values()).map((processingState) => (
            <Marker
              key={`processing-${processingState.camera.id}`}
              coordinate={{
                latitude: processingState.camera.latitude,
                longitude: processingState.camera.longitude,
              }}
              title={`${processingState.camera.name} - ${getCameraStatusText(processingState.camera.id)}`}
              description={`${processingState.camera.area} - ${processingState.camera.name}`}
              pinColor={getCameraMarkerColor(processingState.camera.id)}
              onPress={() => {
                if (processingState.status === 'pending' || processingState.status === 'error') {
                  Alert.alert(
                    `Retry Analysis: ${processingState.camera.name}`,
                    `Do you want to retry analyzing this camera (${processingState.camera.area}) with Moondream AI?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Retry', onPress: () => analyzeSingleCamera(processingState.camera) }
                    ]
                  );
                }
              }}
            />
          ))}

          {/* Regular Camera Markers (not being processed) */}
          {mapState.cameras
            .filter(camera => {
              // Show all cameras, not just those in view (for debugging)
              const notProcessing = !mapState.processingCameras.has(camera.id);
              return notProcessing;
            })
            .slice(0, 50) // Show more markers for better visibility
            .map((camera) => (
              <Marker
                key={camera.id}
                coordinate={{
                  latitude: camera.latitude,
                  longitude: camera.longitude,
                }}
                title={camera.name}
                description={`${camera.area} - ${camera.name}`}
                pinColor="#CCCCCC"
                onPress={() => {
                  Alert.alert(
                    `Analyze Camera: ${camera.name}`,
                    `Do you want to analyze this camera (${camera.area}) with Moondream AI? This will use API credits.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Analyze', onPress: () => analyzeSingleCamera(camera) }
                    ]
                  );
                }}
              />
            ))}

          {/* User-reported blocks */}
          {blocks.map((block) => (
            <Marker
              key={`block-${block.id}`}
              coordinate={{
                latitude: block.lat,
                longitude: block.lng,
              }}
              title={`Safety Score: ${block.score}/10`}
              description="User-verified location"
              pinColor={block.score >= 7 ? '#00FF00' : block.score >= 4 ? '#FFAA00' : '#FF0000'}
            />
          ))}
        </MapView>

        {/* Map Controls */}
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              { backgroundColor: mapState.showHeatMap ? '#4A90E2' : '#666666' }
            ]}
            onPress={toggleHeatMap}
          >
            <Text style={styles.controlButtonText}>
              {mapState.showHeatMap ? '🔥 Heat Map ON' : '🗺️ Heat Map OFF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              { backgroundColor: mapState.showDataPanel ? '#FF6600' : '#666666' }
            ]}
            onPress={toggleDataPanel}
          >
            <Text style={styles.controlButtonText}>
              {mapState.showDataPanel ? '📊 Data ON' : '📊 Data OFF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              { backgroundColor: mapState.showDevMode ? '#FF00FF' : '#666666' }
            ]}
            onPress={toggleDevMode}
          >
            <Text style={styles.controlButtonText}>
              {mapState.showDevMode ? '🔬 Dev ON' : '🔬 Dev OFF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: '#00AA00' }]}
            onPress={refreshAnalysis}
            disabled={mapState.isAnalyzing}
          >
            <Text style={styles.controlButtonText}>
              {mapState.isAnalyzing ? '⏳ Processing...' : '🔄 Refresh'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status Panel */}
      <View style={styles.statusPanel}>
        {mapState.isAnalyzing ? (
          <View style={styles.analysisStatus}>
            <ActivityIndicator size="small" color="#4A90E2" />
            <Text style={styles.analysisText}>{mapState.analysisProgress}</Text>
          </View>
        ) : (
          <View style={styles.infoPanel}>
            <Text style={styles.infoTitle}>
              📊 NYC CCTV: {mapState.cameras.length} total • {mapState.completedAnalyses.length} analyzed • {mapState.heatMapData.length} mapped
            </Text>
            <Text style={styles.infoText}>
              Tap any gray camera marker → Confirm in dialog → AI analysis starts
            </Text>
          </View>
        )}
      </View>

      {/* Data Panel Modal */}
      <Modal
        visible={mapState.showDataPanel}
        animationType="slide"
        transparent={true}
        onRequestClose={toggleDataPanel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dataPanel}>
            <View style={styles.dataPanelHeader}>
              <Text style={styles.dataPanelTitle}>🔍 Live CCTV Analysis Data</Text>
              <TouchableOpacity onPress={toggleDataPanel} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.dataPanelContent}>
              {mapState.completedAnalyses.length === 0 ? (
                <Text style={styles.noDataText}>No analysis data yet. Tap on the map to start processing CCTV cameras.</Text>
              ) : (
                mapState.completedAnalyses.map((analysis, index) => (
                  <View key={`analysis-${index}`} style={styles.analysisCard}>
                    <Text style={styles.analysisCardTitle}>
                      📹 Camera {analysis.cameraId.slice(-8)}
                    </Text>
                    <Text style={styles.analysisCardSubtitle}>
                      Analyzed: {analysis.lastAnalyzed.toLocaleTimeString()}
                    </Text>
                    
                    <View style={styles.riskScoreContainer}>
                      <Text style={[
                        styles.riskScore,
                        { color: analysis.riskScore >= 7 ? '#00FF00' : analysis.riskScore >= 4 ? '#FFAA00' : '#FF0000' }
                      ]}>
                        Risk Score: {analysis.riskScore}/10
                      </Text>
                      <Text style={styles.confidenceText}>
                        Confidence: {analysis.confidence}
                      </Text>
                    </View>

                    <View style={styles.detectionCounts}>
                      <Text style={styles.countText}>🚴‍♀️ Bikes: {analysis.bikeCount}</Text>
                      <Text style={styles.countText}>🚛 Trucks: {analysis.truckCount}</Text>
                      <Text style={styles.countText}>🚶‍♂️ Pedestrians: {analysis.pedestrianCount}</Text>
                    </View>

                    <Text style={styles.trafficDensity}>
                      🚦 Traffic: {analysis.trafficDensity}
                    </Text>
                    
                    <Text style={styles.sceneDescription}>
                      📝 Scene: {analysis.sceneDescription}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Development Mode Modal */}
      <Modal
        visible={mapState.showDevMode}
        animationType="slide"
        transparent={true}
        onRequestClose={toggleDevMode}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.devPanel}>
            <View style={styles.dataPanelHeader}>
              <Text style={styles.dataPanelTitle}>🔬 Development Mode</Text>
              <TouchableOpacity onPress={toggleDevMode} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.dataPanelContent}>
              {mapState.selectedCameraForDev ? (
                <View style={styles.devCameraView}>
                  <Text style={styles.devCameraTitle}>
                    📹 {mapState.selectedCameraForDev.name}
                  </Text>
                  <Text style={styles.devCameraSubtitle}>
                    📍 {mapState.selectedCameraForDev.area}
                  </Text>
                  <Text style={styles.devCameraUrl}>
                    🔗 {mapState.selectedCameraForDev.imageUrl}
                  </Text>
                  
                  <View style={styles.devImageContainer}>
                    <Image
                      source={{ uri: mapState.selectedCameraForDev.imageUrl }}
                      style={styles.devCameraImage}
                      resizeMode="contain"
                    />
                    {/* TODO: Add bounding boxes overlay here */}
                  </View>

                  {/* Analysis Status */}
                  <View style={styles.devAnalysisStatus}>
                    <Text style={styles.devStatusTitle}>Analysis Status:</Text>
                    {mapState.isAnalyzing ? (
                      <View style={styles.devAnalyzing}>
                        <ActivityIndicator size="small" color="#4A90E2" />
                        <Text style={styles.devAnalyzingText}>Running Moondream AI...</Text>
                      </View>
                    ) : (
                      <Text style={styles.devStatusText}>
                        {getCameraStatusText(mapState.selectedCameraForDev.id)}
                      </Text>
                    )}
                  </View>

                  {/* Detection Results */}
                  {mapState.processingCameras.get(mapState.selectedCameraForDev.id)?.analysis && (
                    <View style={styles.devResults}>
                      <Text style={styles.devResultsTitle}>🎯 Detection Results:</Text>
                      {(() => {
                        const analysis = mapState.processingCameras.get(mapState.selectedCameraForDev.id)?.analysis;
                        if (!analysis) return null;
                        return (
                          <View>
                            <Text style={styles.devResultText}>🚴 Bicycles: {analysis.bikeCount}</Text>
                            <Text style={styles.devResultText}>🚛 Trucks: {analysis.truckCount}</Text>
                            <Text style={styles.devResultText}>🚶 Pedestrians: {analysis.pedestrianCount}</Text>
                            <Text style={styles.devResultText}>🚦 Traffic: {analysis.trafficDensity}</Text>
                            <Text style={styles.devResultText}>🛤️ Sidewalk: {analysis.sidewalkCondition}</Text>
                            <Text style={styles.devResultText}>⚠️ Risk Score: {analysis.riskScore}/10</Text>
                            <Text style={styles.devResultText}>🎯 Confidence: {analysis.confidence}</Text>
                            <Text style={styles.devSceneText}>📝 Scene: {analysis.sceneDescription}</Text>
                          </View>
                        );
                      })()}
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.devNoCamera}>
                  <Text style={styles.devNoCameraText}>
                    🔬 Development Mode Active
                  </Text>
                  <Text style={styles.devNoCameraSubtext}>
                    Tap on any camera marker to see:
                    • Live camera image
                    • AI detection process
                    • Bounding boxes (coming soon)
                    • Detailed analysis results
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Camera Status & Risk Level:</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#FFA500' }]} />
            <Text style={styles.legendText}>Queued</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#00BFFF' }]} />
            <Text style={styles.legendText}>Analyzing</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#00FF00' }]} />
            <Text style={styles.legendText}>Safe</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#FF0000' }]} />
            <Text style={styles.legendText}>High Risk</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#CCCCCC',
    textAlign: 'center',
    marginTop: 4,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapControls: {
    position: 'absolute',
    top: 20,
    right: 20,
    gap: 8,
  },
  controlButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusPanel: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  analysisStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  analysisText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  infoPanel: {
    alignItems: 'center',
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  infoText: {
    color: '#CCCCCC',
    fontSize: 11,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  dataPanel: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.7,
  },
  dataPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  dataPanelTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dataPanelContent: {
    flex: 1,
    padding: 16,
  },
  noDataText: {
    color: '#CCCCCC',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
    lineHeight: 20,
  },
  analysisCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  analysisCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  analysisCardSubtitle: {
    color: '#CCCCCC',
    fontSize: 12,
    marginBottom: 12,
  },
  riskScoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  riskScore: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  confidenceText: {
    color: '#CCCCCC',
    fontSize: 12,
  },
  detectionCounts: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  trafficDensity: {
    color: '#FFFFFF',
    fontSize: 12,
    marginBottom: 8,
  },
  sceneDescription: {
    color: '#CCCCCC',
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  legend: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  legendTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: '#CCCCCC',
    fontSize: 9,
  },
  // Development Mode Styles
  devPanel: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.8,
  },
  devCameraView: {
    padding: 16,
  },
  devCameraTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  devCameraSubtitle: {
    color: '#CCCCCC',
    fontSize: 14,
    marginBottom: 8,
  },
  devCameraUrl: {
    color: '#4A90E2',
    fontSize: 10,
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  devImageContainer: {
    backgroundColor: '#000000',
    borderRadius: 8,
    marginBottom: 16,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devCameraImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  devAnalysisStatus: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  devStatusTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  devAnalyzing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  devAnalyzingText: {
    color: '#4A90E2',
    fontSize: 14,
  },
  devStatusText: {
    color: '#CCCCCC',
    fontSize: 14,
  },
  devResults: {
    padding: 12,
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    borderRadius: 8,
    marginBottom: 16,
  },
  devResultsTitle: {
    color: '#00FF00',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  devResultText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 4,
  },
  devSceneText: {
    color: '#CCCCCC',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  devNoCamera: {
    padding: 20,
    alignItems: 'center',
  },
  devNoCameraText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  devNoCameraSubtext: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
