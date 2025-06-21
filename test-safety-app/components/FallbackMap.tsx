import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafety } from './SafetyContext';

const { width, height } = Dimensions.get('window');

interface FallbackMapProps {
  onLocationUpdate?: (location: any) => void;
}

export default function FallbackMapComponent({ onLocationUpdate }: FallbackMapProps) {
  const { blocks, updateBlockSafety } = useSafety();
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);

  // Request location permissions and get user location
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setIsLocationEnabled(true);
        getCurrentLocation();
      } else {
        Alert.alert('Location Permission', 'Location permission is required to show your position on the map.');
      }
    } catch (error) {
      console.error('Location permission error:', error);
    }
  };

  // Get current user location
  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const locationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(locationData);
      if (onLocationUpdate) {
        onLocationUpdate(locationData);
      }
      
      // Center map on user location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          ...locationData,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  // Function to get color based on safety score
  const getSafetyColor = (score: number) => {
    if (score >= 7) return '#34C759'; // Green - Safe
    if (score >= 4) return '#FF9500'; // Orange - Moderate
    return '#FF3B30'; // Red - Dangerous
  };

  // Function to get safety status text
  const getSafetyStatus = (score: number) => {
    if (score >= 7) return 'Safe';
    if (score >= 4) return 'Moderate';
    return 'Dangerous';
  };

  // Handle marker press
  const onMarkerPress = (block: any) => {
    Alert.alert(
      `Block ${block.id}`,
      `Safety Score: ${block.score}/10\nStatus: ${getSafetyStatus(block.score)}\nLast Updated: ${block.lastUpdated || 'Never'}`
    );
  };

  useEffect(() => {
    requestLocationPermission();
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: 37.7749,
          longitude: -122.4194,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {/* Safety Block Markers */}
        {blocks.map(block => (
          <Marker
            key={block.id}
            coordinate={{
              latitude: block.lat,
              longitude: block.lng,
            }}
            title={`Block ${block.id}`}
            description={`Safety Score: ${block.score}/10 - ${getSafetyStatus(block.score)}`}
            onPress={() => onMarkerPress(block)}
            pinColor={getSafetyColor(block.score)}
          />
        ))}
      </MapView>

      {/* Safety Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Safety Legend</Text>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#34C759' }]} />
          <Text style={styles.legendText}>Safe (7-10)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FF9500' }]} />
          <Text style={styles.legendText}>Moderate (4-6)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FF3B30' }]} />
          <Text style={styles.legendText}>Dangerous (1-3)</Text>
        </View>
      </View>

      {/* Location Button */}
      <TouchableOpacity 
        style={styles.locationButton}
        onPress={getCurrentLocation}
      >
        <Text style={styles.locationButtonText}>📍 My Location</Text>
      </TouchableOpacity>

      {/* Test Update Button */}
      <TouchableOpacity 
        style={styles.testButton}
        onPress={() => {
          const randomBlock = blocks[Math.floor(Math.random() * blocks.length)];
          const randomBikes = Math.floor(Math.random() * 5) + 1;
          updateBlockSafety(randomBlock.id, randomBikes);
          Alert.alert(
            'Test Update',
            `Updated Block ${randomBlock.id} with ${randomBikes} bikes detected.\nNew safety score: ${Math.max(1, 10 - randomBikes)}/10`
          );
        }}
      >
        <Text style={styles.testButtonText}>Test Update (Random)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  legend: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  legendTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
  },
  locationButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
  },
  locationButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  testButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 