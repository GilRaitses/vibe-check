import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export default function SafetyMapScreen() {
  // Placeholder data for blocks with safety scores
  const blocks = [
    { id: 1, lat: 37.7749, lng: -122.4194, score: 8 },
    { id: 2, lat: 37.7755, lng: -122.4185, score: 5 },
    { id: 3, lat: 37.7760, lng: -122.4170, score: 2 },
  ];

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: 37.7749,
          longitude: -122.4194,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {blocks.map(block => (
          <Marker
            key={block.id}
            coordinate={{ latitude: block.lat, longitude: block.lng }}
            title={`Block ${block.id}`}
            description={`Safety Score: ${block.score}`}
            pinColor={block.score > 6 ? 'green' : block.score > 3 ? 'orange' : 'red'}
          >
            <View style={styles.marker}>
              <Text style={styles.markerText}>{block.score}</Text>
            </View>
          </Marker>
        ))}
      </MapView>
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
  marker: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
  },
  markerText: {
    fontWeight: 'bold',
    color: '#333',
  },
}); 