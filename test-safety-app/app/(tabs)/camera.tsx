import React, { useRef, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Image, ActivityIndicator, Alert } from 'react-native';
import { Camera } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import * as tfReactNative from '@tensorflow/tfjs-react-native';
import * as FileSystem from 'expo-file-system';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = React.useState<boolean | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bikeCount, setBikeCount] = useState<number | null>(null);
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
      // Count bikes
      const bikes = predictions.filter((p: any) => p.class === 'bicycle');
      setBikeCount(bikes.length);
    } catch (err) {
      Alert.alert('Detection Error', 'Could not run bike detection.');
      setBikeCount(null);
    } finally {
      setIsProcessing(false);
    }
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
        <Image source={{ uri: capturedPhoto }} style={styles.camera} />
      )}
      <TouchableOpacity style={styles.button} onPress={takePicture} disabled={isProcessing}>
        <Text style={styles.buttonText}>{isProcessing ? 'Processing...' : 'Take Picture'}</Text>
      </TouchableOpacity>
      {isProcessing && <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 16 }} />}
      {bikeCount !== null && !isProcessing && (
        <Text style={styles.resultText}>Detected bikes: {bikeCount}</Text>
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
    width: '90%',
    height: 400,
    borderRadius: 16,
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
  resultText: {
    marginTop: 24,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
}); 