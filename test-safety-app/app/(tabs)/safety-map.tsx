import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafety } from '@/components/SafetyContext';

export default function SafetyMapScreen() {
  const { blocks, updateBlockSafety } = useSafety();

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
            description={`Safety Score: ${block.score}/10 - ${getSafetyStatus(block.score)}`}
            pinColor={getSafetyColor(block.score)}
          >
            <View style={[styles.marker, { backgroundColor: getSafetyColor(block.score) }]}>
              <Text style={styles.markerText}>{block.score}</Text>
            </View>
          </Marker>
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
  marker: {
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
    color: '#fff',
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