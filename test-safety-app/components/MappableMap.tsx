import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView from 'react-native-maps';

interface MappableMapProps {
  onLocationUpdate?: (location: any) => void;
}

export default function MappableMapComponent({ onLocationUpdate }: MappableMapProps) {
  useEffect(() => {
    console.log(`🗺️ [HACKATHON] Clean map component loaded`);
  }, []);

  return (
    <View style={styles.container}>
      {/* Clean React Native Map */}
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 40.7589, // NYC center
          longitude: -73.9851,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        showsScale={true}
        onRegionChangeComplete={(region) => {
          if (onLocationUpdate) {
            onLocationUpdate({
              latitude: region.latitude,
              longitude: region.longitude
            });
          }
        }}
      />
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
}); 