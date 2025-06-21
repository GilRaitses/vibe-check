import React, { useRef, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Image, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { Camera } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import * as tfReactNative from '@tensorflow/tfjs-react-native';
import * as FileSystem from 'expo-file-system';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';
import { useSafety } from '@/components/SafetyContext';

const { width: screenWidth } = Dimensions.get('window');
const imageWidth = screenWidth * 0.9;
const imageHeight = 400;

interface Detection {
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
  score: number;
}

export default function CameraScreen() {
  const { updateBlockSafety } = useSafety();
  const [hasPermission, setHasPermission] = React.useState<boolean | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bikeCount, setBikeCount] = useState<number | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const cameraRef = useRef<Camera | null>(null);

  React.useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      // Prepare TensorFlow.js
      await tf.ready();
      await tfReactNative.setBackend('rn-webgl');
    })();
  }, []);

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
      // For demo purposes, update a random block
      const randomBlockId = Math.floor(Math.random() * 3) + 1;
      updateBlockSafety(randomBlockId, bikeCount);
      const safetyScore = Math.max(1, 10 - bikeCount);
      Alert.alert(
        'Safety Score Updated',
        `Bikes detected: ${bikeCount}\nUpdated Block ${randomBlockId}\nNew safety score: ${safetyScore}/10\n\nCheck the Safety Map to see the update!`
      );
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