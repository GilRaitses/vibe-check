import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Image, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { Camera } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import * as tfReactNative from '@tensorflow/tfjs-react-native';
import * as FileSystem from 'expo-file-system';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';
import { useSafety } from '@/components/SafetyContext';
import { MappableLocation } from '@mappable/mappable-react-native';

const { width: screenWidth } = Dimensions.get('window');
const imageWidth = screenWidth * 0.9;
const imageHeight = 400;

interface Detection {
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
  score: number;
}

interface Block {
  id: number;
  lat: number;
  lng: number;
  score: number;
}

export default function CameraScreen() {
  const { blocks, updateBlockSafety } = useSafety();
  const [hasPermission, setHasPermission] = React.useState<boolean | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bikeCount, setBikeCount] = useState<number | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [nearestBlock, setNearestBlock] = useState<Block | null>(null);
  const cameraRef = useRef<Camera | null>(null);

  React.useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      // Prepare TensorFlow.js
      await tf.ready();
      await tfReactNative.setBackend('rn-webgl');
      // Get current location
      getCurrentLocation();
    })();
  }, []);

  // Get current location using Mappable
  const getCurrentLocation = async () => {
    try {
      const permission = await MappableLocation.requestPermission();
      if (permission === 'granted') {
        const location = await MappableLocation.getCurrentPosition();
        setCurrentLocation(location);
        findNearestBlock(location);
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
    setBikeCount(null);
    setCapturedPhoto(null);
    setIsProcessing(false);
    setDetections([]);
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      setCapturedPhoto(photo.uri);
      setIsProcessing(true);
      setTimeout(() => runBikeDetection(photo.uri), 500); // Give time for image to render
    }
  };

  // Load COCO-SSD model from tfjs repo
  const loadModel = async () => {
    // Use coco-ssd from tfjs-models
    const cocoSsd = await import('@tensorflow-models/coco-ssd');
    const model = await cocoSsd.load();
    return model;
  };

  // Run bike detection on the captured image
  const runBikeDetection = async (uri: string) => {
    try {
      const model = await loadModel();
      // Get image as tensor
      const imgB64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const imgBuffer = tf.util.encodeString(imgB64, 'base64').buffer;
      const raw = new Uint8Array(imgBuffer);
      const imageTensor = tfReactNative.decodeJpeg(raw);
      // Run detection
      const predictions = await model.detect(imageTensor);
      // Filter for bikes and store detections
      const bikeDetections = predictions.filter((p: any) => p.class === 'bicycle');
      setDetections(bikeDetections);
      setBikeCount(bikeDetections.length);
    } catch (err) {
      Alert.alert('Detection Error', 'Could not run bike detection.');
      setBikeCount(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Save detection results to update map
  const saveToMap = () => {
    if (bikeCount !== null) {
      if (nearestBlock) {
        updateBlockSafety(nearestBlock.id, bikeCount);
        const safetyScore = Math.max(1, 10 - bikeCount);
        Alert.alert(
          'Safety Score Updated',
          `Bikes detected: ${bikeCount}\nUpdated Block ${nearestBlock.id} (nearest to you)\nNew safety score: ${safetyScore}/10\n\nCheck the Safety Map to see the update!`
        );
      } else {
        // Fallback to random block if location not available
        const randomBlockId = Math.floor(Math.random() * 3) + 1;
        updateBlockSafety(randomBlockId, bikeCount);
        const safetyScore = Math.max(1, 10 - bikeCount);
        Alert.alert(
          'Safety Score Updated',
          `Bikes detected: ${bikeCount}\nUpdated Block ${randomBlockId}\nNew safety score: ${safetyScore}/10\n\nCheck the Safety Map to see the update!`
        );
      }
    }
  };

  // Render bounding boxes
  const renderBoundingBoxes = () => {
    return detections.map((detection, index) => {
      const [x, y, width, height] = detection.bbox;
      const scaleX = imageWidth / 640; // Assuming model input size of 640x640
      const scaleY = imageHeight / 640;
      
      return (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: x * scaleX,
            top: y * scaleY,
            width: width * scaleX,
            height: height * scaleY,
            borderWidth: 2,
            borderColor: '#FF0000',
            backgroundColor: 'transparent',
          }}
        />
      );
    });
  };

  if (hasPermission === null) {
    return <View style={styles.container}><Text>Requesting camera permission...</Text></View>;
  }
  if (hasPermission === false) {
    return <View style={styles.container}><Text>No access to camera</Text></View>;
  }

  return (
    <View style={styles.container}>
      {!capturedPhoto ? (
        <Camera style={styles.camera} ref={ref => (cameraRef.current = ref)} />
      ) : (
        <View style={styles.imageContainer}>
          <Image source={{ uri: capturedPhoto }} style={styles.camera} />
          {renderBoundingBoxes()}
        </View>
      )}
      
      {/* Location Info */}
      {nearestBlock && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationText}>Nearest Block: {nearestBlock.id}</Text>
          <Text style={styles.locationText}>Current Safety: {nearestBlock.score}/10</Text>
        </View>
      )}
      
      <TouchableOpacity style={styles.button} onPress={takePicture} disabled={isProcessing}>
        <Text style={styles.buttonText}>{isProcessing ? 'Processing...' : 'Take Picture'}</Text>
      </TouchableOpacity>
      {isProcessing && <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 16 }} />}
      {bikeCount !== null && !isProcessing && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultText}>Detected bikes: {bikeCount}</Text>
          <TouchableOpacity style={styles.saveButton} onPress={saveToMap}>
            <Text style={styles.saveButtonText}>Update Map</Text>
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