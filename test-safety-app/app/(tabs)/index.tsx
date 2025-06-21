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
      setMapState(prev => ({ ...prev, cameras }));
    } catch (error) {
      console.error('❌ [HACKATHON] Error loading cameras:', error);
    }
  };

  const analyzeNearbyArea = async (latitude: number, longitude: number) => {
    setMapState(prev => ({ 
      ...prev, 
      isAnalyzing: true,
      analysisProgress: 'Finding nearby NYC CCTV cameras...',
      processingCameras: new Map(),
      completedAnalyses: []
    }));

    try {
      // Get cameras in the vicinity (limit to reasonable number)
      const allNearbyCameras = await NYCCameraService.getCamerasNearLocation(latitude, longitude, 2);
      const nearbyCameras = allNearbyCameras.slice(0, 10); // Limit to 10 cameras max
      
      if (nearbyCameras.length === 0) {
        setMapState(prev => ({ 
          ...prev, 
          isAnalyzing: false,
          analysisProgress: 'No NYC CCTV cameras found in this area'
        }));
        return;
      }

      if (allNearbyCameras.length > 10) {
        console.log(`Found ${allNearbyCameras.length} cameras, analyzing closest 10 to avoid API limits`);
      }

      // Initialize processing states for all cameras
      const processingMap = new Map<string, CameraProcessingState>();
      nearbyCameras.forEach(camera => {
        processingMap.set(camera.id, {
          camera,
          status: 'pending',
          startTime: new Date()
        });
      });

      setMapState(prev => ({ 
        ...prev, 
        processingCameras: processingMap,
        analysisProgress: `Found ${nearbyCameras.length} NYC CCTV cameras. Starting AI analysis...`
      }));

      // Analyze cameras in batches with real-time updates
      const batchSize = 2;
      const heatMapPoints: Array<{ latitude: number; longitude: number; weight: number }> = [];

      for (let i = 0; i < nearbyCameras.length; i += batchSize) {
        const batch = nearbyCameras.slice(i, i + batchSize);
        
        setMapState(prev => ({ 
          ...prev, 
          analysisProgress: `Analyzing CCTV cameras ${i + 1}-${Math.min(i + batchSize, nearbyCameras.length)} of ${nearbyCameras.length}...`
        }));

        // Update status to analyzing for current batch
        batch.forEach(camera => {
          setMapState(prev => {
            const newProcessingMap = new Map(prev.processingCameras);
            const currentState = newProcessingMap.get(camera.id);
            if (currentState) {
              newProcessingMap.set(camera.id, {
                ...currentState,
                status: 'analyzing'
              });
            }
            return { ...prev, processingCameras: newProcessingMap };
          });
        });

        // Process batch in parallel
        const analysisPromises = batch.map(camera => 
          NYCCameraService.analyzeCameraRisk(camera)
            .then(analysis => ({ camera, analysis, success: true }))
            .catch(error => ({ camera, error, success: false }))
        );

        const results = await Promise.allSettled(analysisPromises);
        
                  results.forEach((result, index) => {
            const camera = batch[index];
            
            if (result.status === 'fulfilled' && result.value.success && 'analysis' in result.value) {
              const analysis = result.value.analysis;
            
            // Update processing state to completed
            setMapState(prev => {
              const newProcessingMap = new Map(prev.processingCameras);
              const currentState = newProcessingMap.get(camera.id);
              if (currentState) {
                newProcessingMap.set(camera.id, {
                  ...currentState,
                  status: 'completed',
                  analysis,
                  completionTime: new Date()
                });
              }
              
              // Add to completed analyses for data panel
              const newCompletedAnalyses = [...prev.completedAnalyses, analysis];
              
              return { 
                ...prev, 
                processingCameras: newProcessingMap,
                completedAnalyses: newCompletedAnalyses
              };
            });
            
            // Convert risk score to heat map weight (invert: lower risk = higher weight)
            const weight = (11 - analysis.riskScore) / 10; // 0.1 to 1.0
            
            heatMapPoints.push({
              latitude: camera.latitude,
              longitude: camera.longitude,
              weight: weight
            });
          } else {
            // Update processing state to error
            setMapState(prev => {
              const newProcessingMap = new Map(prev.processingCameras);
              const currentState = newProcessingMap.get(camera.id);
              if (currentState) {
                newProcessingMap.set(camera.id, {
                  ...currentState,
                  status: 'error',
                  completionTime: new Date()
                });
              }
              return { ...prev, processingCameras: newProcessingMap };
            });
          }
        });

        // Update heat map progressively
        setMapState(prev => ({ 
          ...prev, 
          heatMapData: [...heatMapPoints]
        }));

        // Small delay between batches
        if (i + batchSize < nearbyCameras.length) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      setMapState(prev => ({ 
        ...prev, 
        isAnalyzing: false,
        analysisProgress: `Analysis complete! Processed ${heatMapPoints.length} CCTV cameras with AI.`
      }));

    } catch (error) {
      console.error('Error analyzing area:', error);
      setMapState(prev => ({ 
        ...prev, 
        isAnalyzing: false,
        analysisProgress: 'Analysis failed. Try again.'
      }));
    }
  };

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

  const analyzeSingleCamera = async (camera: NYCCamera) => {
    console.log(`🎯 [HACKATHON] User tapped on camera: ${camera.name} (${camera.area})`);
    console.log(`📸 [HACKATHON] Starting on-demand analysis for camera ${camera.id}`);
    
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
        analysisProgress: `Analyzing ${camera.name} with Moondream AI...`
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
                  analyzeSingleCamera(processingState.camera);
                }
              }}
            />
          ))}

          {/* Regular Camera Markers (not being processed) */}
          {mapState.cameras
            .filter(camera => {
              // Only show cameras in current view and not being processed
              const { region } = mapState;
              const inView = (
                camera.latitude >= region.latitude - region.latitudeDelta / 2 &&
                camera.latitude <= region.latitude + region.latitudeDelta / 2 &&
                camera.longitude >= region.longitude - region.longitudeDelta / 2 &&
                camera.longitude <= region.longitude + region.longitudeDelta / 2
              );
              const notProcessing = !mapState.processingCameras.has(camera.id);
              return inView && notProcessing;
            })
            .slice(0, 15) // Limit markers for performance
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
                onPress={() => analyzeSingleCamera(camera)}
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
              Tap on any camera marker to analyze it with Moondream AI
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
});
