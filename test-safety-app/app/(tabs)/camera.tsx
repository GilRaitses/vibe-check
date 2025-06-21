import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Image, Alert, Dimensions, Button } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafety } from '@/components/SafetyContext';
import * as Location from 'expo-location';

const { width: screenWidth } = Dimensions.get('window');
const imageWidth = screenWidth * 0.9;
const imageHeight = 400;

interface Block {
  id: number;
  lat: number;
  lng: number;
  score: number;
}

export default function CameraScreen() {
  const { blocks, updateBlockSafety } = useSafety();
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [nearestBlock, setNearestBlock] = useState<Block | null>(null);
  const cameraRef = useRef<CameraView | null>(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
    if (permission?.granted) {
      getCurrentLocation();
    }
  }, [permission]);

  // Get current location using expo-location
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const locationData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        findNearestBlock(locationData);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  // Find the nearest block to the user's location
  const findNearestBlock = (location: any) => {
    if (!location || !blocks.length) return;

    let nearestBlock = blocks[0];
    let minDistance = calculateDistance(
      location.latitude,
      location.longitude,
      blocks[0].lat,
      blocks[0].lng
    );

    blocks.forEach(block => {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        block.lat,
        block.lng
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestBlock = block;
      }
    });

    setNearestBlock(nearestBlock);
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const takePicture = async () => {
    setCapturedPhoto(null);
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      setCapturedPhoto(photo.uri);
    }
  };

  // Simulate bike detection for demo
  const simulateBikeDetection = () => {
    const randomBikeCount = Math.floor(Math.random() * 5) + 1;
    if (nearestBlock) {
      updateBlockSafety(nearestBlock.id, randomBikeCount);
      const safetyScore = Math.max(1, 10 - randomBikeCount);
      Alert.alert(
        'Demo: Safety Score Updated',
        `Simulated bikes detected: ${randomBikeCount}\nUpdated Block ${nearestBlock.id} (nearest to you)\nNew safety score: ${safetyScore}/10\n\nCheck the Safety Map to see the update!`
      );
    } else {
      // Fallback to random block if location not available
      const randomBlockId = Math.floor(Math.random() * 3) + 1;
      updateBlockSafety(randomBlockId, randomBikeCount);
      const safetyScore = Math.max(1, 10 - randomBikeCount);
      Alert.alert(
        'Demo: Safety Score Updated',
        `Simulated bikes detected: ${randomBikeCount}\nUpdated Block ${randomBlockId}\nNew safety score: ${safetyScore}/10\n\nCheck the Safety Map to see the update!`
      );
    }
  };

  if (!permission) {
    // Camera permissions are still loading.
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>
          We need your permission to show the camera
        </Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!capturedPhoto ? (
        <CameraView style={styles.camera} ref={cameraRef} />
      ) : (
        <View style={styles.imageContainer}>
          <Image source={{ uri: capturedPhoto }} style={styles.camera} />
        </View>
      )}
      
      {/* Location Info */}
      {nearestBlock && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationText}>Nearest Block: {nearestBlock.id}</Text>
          <Text style={styles.locationText}>Current Safety: {nearestBlock.score}/10</Text>
        </View>
      )}
      
      <TouchableOpacity style={styles.button} onPress={takePicture}>
        <Text style={styles.buttonText}>Take Picture</Text>
      </TouchableOpacity>
      
      {capturedPhoto && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultText}>Photo captured! (Demo mode)</Text>
          <TouchableOpacity style={styles.saveButton} onPress={simulateBikeDetection}>
            <Text style={styles.saveButtonText}>Simulate Bike Detection</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  camera: {
    width: imageWidth,
    height: imageHeight,
    borderRadius: 16,
    marginBottom: 20,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  locationInfo: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  locationText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  resultsContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  resultText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 