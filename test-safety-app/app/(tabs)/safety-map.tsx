import React, { useState } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import MappableMapComponent from '@/components/MappableMap';
import { useSafety } from '@/components/SafetyContext';

export default function SafetyMapScreen() {
  const { blocks } = useSafety();
  const [currentLocation, setCurrentLocation] = useState<any>(null);

  const handleLocationUpdate = (location: any) => {
    setCurrentLocation(location);
    console.log('Location updated:', location);
  };

  return (
    <View style={styles.container}>
      <MappableMapComponent onLocationUpdate={handleLocationUpdate} />
      
      {/* Location Info Panel */}
      {currentLocation && (
        <View style={styles.locationPanel}>
          <Text style={styles.locationTitle}>Your Location</Text>
          <Text style={styles.locationText}>
            Lat: {currentLocation.latitude.toFixed(6)}
          </Text>
          <Text style={styles.locationText}>
            Lng: {currentLocation.longitude.toFixed(6)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  locationPanel: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  locationTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
  },
}); 