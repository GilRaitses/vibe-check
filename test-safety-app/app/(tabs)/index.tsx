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
} from 'react-native';
import MapView, { Marker, Heatmap, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafety } from '@/components/SafetyContext';
import NYCCameraService, { NYCCamera, CameraRiskAnalysis, HeatMapRegion } from '@/services/nycCameraService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface MapState {
  region: Region;
  userLocation: Location.LocationObject | null;
  cameras: NYCCamera[];
  heatMapData: Array<{
    latitude: number;
    longitude: number;
    weight: number;
  }>;
  isAnalyzing: boolean;
  showHeatMap: boolean;
  analysisProgress: string;
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
    heatMapData: [],
    isAnalyzing: false,
    showHeatMap: true,
    analysisProgress: '',
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

      // Start analyzing cameras near user location
      analyzeNearbyArea(location.coords.latitude, location.coords.longitude);

    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const loadCamerasInBackground = async () => {
    try {
      const cameras = await NYCCameraService.fetchCameras();
      setMapState(prev => ({ ...prev, cameras }));
    } catch (error) {
      console.error('Error loading cameras:', error);
    }
  };

  const analyzeNearbyArea = async (latitude: number, longitude: number) => {
    setMapState(prev => ({ 
      ...prev, 
      isAnalyzing: true,
      analysisProgress: 'Finding nearby cameras...'
    }));

    try {
      // Get cameras in the vicinity
      const nearbyCameras = await NYCCameraService.getCamerasNearLocation(latitude, longitude, 2);
      
      if (nearbyCameras.length === 0) {
        setMapState(prev => ({ 
          ...prev, 
          isAnalyzing: false,
          analysisProgress: 'No cameras found in this area'
        }));
        return;
      }

      setMapState(prev => ({ 
        ...prev, 
        analysisProgress: `Analyzing ${nearbyCameras.length} cameras with AI...`
      }));

      // Analyze cameras in batches to avoid overwhelming the API
      const batchSize = 3;
      const heatMapPoints: Array<{ latitude: number; longitude: number; weight: number }> = [];

      for (let i = 0; i < nearbyCameras.length; i += batchSize) {
        const batch = nearbyCameras.slice(i, i + batchSize);
        
        setMapState(prev => ({ 
          ...prev, 
          analysisProgress: `Analyzing cameras ${i + 1}-${Math.min(i + batchSize, nearbyCameras.length)} of ${nearbyCameras.length}...`
        }));

        const analysisPromises = batch.map(camera => 
          NYCCameraService.analyzeCameraRisk(camera)
        );

        const results = await Promise.allSettled(analysisPromises);
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const analysis = result.value;
            const camera = batch[index];
            
            // Convert risk score to heat map weight (invert: lower risk = higher weight)
            const weight = (11 - analysis.riskScore) / 10; // 0.1 to 1.0
            
            heatMapPoints.push({
              latitude: camera.latitude,
              longitude: camera.longitude,
              weight: weight
            });
          }
        });

        // Update heat map progressively
        setMapState(prev => ({ 
          ...prev, 
          heatMapData: [...heatMapPoints]
        }));

        // Small delay between batches to be respectful to the API
        if (i + batchSize < nearbyCameras.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      setMapState(prev => ({ 
        ...prev, 
        isAnalyzing: false,
        analysisProgress: `Analysis complete! Found ${heatMapPoints.length} data points.`
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
    const { latitude, longitude } = event.nativeEvent.coordinate;
    analyzeNearbyArea(latitude, longitude);
  };

  const toggleHeatMap = () => {
    setMapState(prev => ({ ...prev, showHeatMap: !prev.showHeatMap }));
  };

  const refreshAnalysis = () => {
    if (mapState.userLocation) {
      analyzeNearbyArea(
        mapState.userLocation.coords.latitude,
        mapState.userLocation.coords.longitude
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🗽 NYC Safety Map</Text>
        <Text style={styles.subtitle}>Live AI Analysis from Traffic Cameras</Text>
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

          {/* Camera Markers */}
          {mapState.cameras
            .filter(camera => {
              // Only show cameras in current view
              const { region } = mapState;
              return (
                camera.latitude >= region.latitude - region.latitudeDelta / 2 &&
                camera.latitude <= region.latitude + region.latitudeDelta / 2 &&
                camera.longitude >= region.longitude - region.longitudeDelta / 2 &&
                camera.longitude <= region.longitude + region.longitudeDelta / 2
              );
            })
            .slice(0, 20) // Limit markers for performance
            .map((camera) => (
              <Marker
                key={camera.id}
                coordinate={{
                  latitude: camera.latitude,
                  longitude: camera.longitude,
                }}
                title={camera.name}
                description={`${camera.borough} - ${camera.roadway}`}
                pinColor="#4A90E2"
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
            style={[styles.controlButton, { backgroundColor: '#00AA00' }]}
            onPress={refreshAnalysis}
            disabled={mapState.isAnalyzing}
          >
            <Text style={styles.controlButtonText}>
              {mapState.isAnalyzing ? '⏳ Analyzing...' : '🔄 Refresh'}
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
              📊 Data: {mapState.cameras.length} cameras • {mapState.heatMapData.length} analyzed
            </Text>
            <Text style={styles.infoText}>
              Tap anywhere on the map to analyze that area with AI
            </Text>
          </View>
        )}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Risk Level:</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#00FF00' }]} />
            <Text style={styles.legendText}>Low</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#FFFF00' }]} />
            <Text style={styles.legendText}>Medium</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#FF6600' }]} />
            <Text style={styles.legendText}>High</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#FF0000' }]} />
            <Text style={styles.legendText}>Danger</Text>
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
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
    gap: 10,
  },
  controlButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
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
  },
  infoPanel: {
    alignItems: 'center',
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  infoText: {
    color: '#CCCCCC',
    fontSize: 12,
    textAlign: 'center',
  },
  legend: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  legendTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
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
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    color: '#CCCCCC',
    fontSize: 10,
  },
});
