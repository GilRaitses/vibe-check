import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Image, Alert, Dimensions, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafety } from '@/components/SafetyContext';
import * as Location from 'expo-location';
import MoondreamService, { BicycleDetectionResult, DetectedObject } from '@/services/moondreamService';
import BicycleDetectionOverlay from '@/components/BicycleDetectionOverlay';

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectionResult, setDetectionResult] = useState<BicycleDetectionResult | null>(null);
  const [showVerificationOverlay, setShowVerificationOverlay] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const cameraRef = useRef<CameraView | null>(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
    if (permission?.granted) {
      getCurrentLocation();
    }
  }, [permission]);

  // Get current location and find nearest block
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for safety mapping.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Find nearest block (simplified - just use first block for demo)
      if (blocks.length > 0) {
        setNearestBlock(blocks[0]);
      } else {
        // Create a new block for this location
        const newBlock: Block = {
          id: 0,
          lat: latitude,
          lng: longitude,
          score: 5 // Default neutral score
        };
        setNearestBlock(newBlock);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Could not get current location.');
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'Camera not ready');
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: false,
      });

      if (photo) {
        setCapturedPhoto(photo.uri);
        
        // Get image dimensions
        Image.getSize(photo.uri, (width, height) => {
          setImageSize({ width, height });
        });

        // Start analyzing with Moondream
        setIsAnalyzing(true);
        try {
          const result = await MoondreamService.detectBicycles(photo.uri);
          setDetectionResult(result);
          setIsAnalyzing(false);
          
          if (result.totalCount > 0) {
            // Show verification overlay
            setShowVerificationOverlay(true);
          } else {
            // No bicycles detected, show context about what was detected
            const sidewalkCount = result.sidewalks.length;
            const message = result.hasSidewalk 
              ? `✅ Sidewalk/pavement detected!\n\n🚴‍♀️ No bicycles found on the sidewalk.\n\nScene: ${result.sceneDescription}\n\nThis indicates a safe area for pedestrians.`
              : `❓ No clear sidewalk detected in this image.\n\nScene: ${result.sceneDescription}\n\nTry pointing the camera at a sidewalk or pedestrian area.`;
            
            Alert.alert(
              result.hasSidewalk ? 'Safe Sidewalk Detected!' : 'No Sidewalk Detected',
              message,
              [
                {
                  text: 'Add Bicycles Manually',
                  onPress: () => setShowVerificationOverlay(true)
                },
                {
                  text: result.hasSidewalk ? 'Confirm - Safe Area' : 'Try Again',
                  onPress: () => result.hasSidewalk ? handleVerificationComplete([], []) : resetCamera()
                }
              ]
            );
          }
        } catch (error) {
          setIsAnalyzing(false);
          console.error('Error analyzing image:', error);
          Alert.alert(
            'Analysis Failed',
            'Could not analyze the image. You can still manually mark bicycles.',
            [
              {
                text: 'Manual Marking',
                onPress: () => {
                  setDetectionResult({
                    bicycles: [],
                    sidewalks: [],
                    totalCount: 0,
                    confidence: 'low',
                    safetyScore: 10,
                    sceneDescription: 'Manual detection mode',
                    hasSidewalk: true
                  });
                  setShowVerificationOverlay(true);
                }
              },
              { text: 'Cancel', onPress: () => setCapturedPhoto(null) }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture');
    }
  };

  const handleVerificationComplete = (
    verifiedBicycles: DetectedObject[], 
    userAddedCircles: any[]
  ) => {
    const totalBicycles = verifiedBicycles.length + userAddedCircles.length;
    
    // Calculate safety score based on total verified bicycles
    let safetyScore = 10;
    if (totalBicycles === 1) safetyScore = 7;
    else if (totalBicycles === 2) safetyScore = 5;
    else if (totalBicycles === 3) safetyScore = 3;
    else if (totalBicycles > 3) safetyScore = Math.max(1, 3 - (totalBicycles - 3));

    // Update the safety map with the new score
    if (nearestBlock) {
      updateBlockSafety(nearestBlock.id, safetyScore);
    }

    // Show results
    Alert.alert(
      'Safety Assessment Complete',
      `Detected ${totalBicycles} bicycle(s) on sidewalk.\nSafety Score: ${safetyScore}/10\n\nThis location has been updated on the safety map.`,
      [
        { text: 'Take Another Photo', onPress: resetCamera },
        { text: 'View on Map', onPress: () => {
          resetCamera();
          // Navigate to map tab would go here
        }}
      ]
    );
  };

  const resetCamera = () => {
    setCapturedPhoto(null);
    setDetectionResult(null);
    setShowVerificationOverlay(false);
    setIsAnalyzing(false);
    setImageSize({ width: 0, height: 0 });
  };

  if (!permission) {
    return <View style={styles.container}><Text>Loading...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show verification overlay
  if (showVerificationOverlay && capturedPhoto && detectionResult) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedPhoto }} style={styles.capturedImage} />
        <BicycleDetectionOverlay
          imageWidth={imageSize.width}
          imageHeight={imageSize.height}
          detectedBicycles={detectionResult.bicycles}
          detectedSidewalks={detectionResult.sidewalks}
          onVerificationComplete={handleVerificationComplete}
          onCancel={() => setShowVerificationOverlay(false)}
        />
      </View>
    );
  }

  // Show captured photo with analysis
  if (capturedPhoto) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedPhoto }} style={styles.capturedImage} />
        
        {isAnalyzing && (
          <View style={styles.analysisOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.analysisText}>Analyzing image with Moondream AI...</Text>
            <Text style={styles.analysisSubtext}>Detecting bicycles on sidewalk</Text>
          </View>
        )}

        {!isAnalyzing && (
          <View style={styles.resultsOverlay}>
            <TouchableOpacity style={styles.button} onPress={resetCamera}>
              <Text style={styles.buttonText}>Take Another Photo</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Camera view
  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        facing="back"
        ref={cameraRef}
      >
        <View style={styles.overlay}>
          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>Bicycle Safety Detection</Text>
            <Text style={styles.instructionsText}>
              Point camera at sidewalk and take a photo to detect bicycles
            </Text>
            {nearestBlock && (
              <Text style={styles.locationText}>
                📍 Current safety score: {nearestBlock.score}/10
              </Text>
            )}
          </View>

          {/* Camera controls */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>

          {/* Info panel */}
          <View style={styles.infoPanel}>
            <Text style={styles.infoPanelTitle}>🚴‍♀️ How it works:</Text>
            <Text style={styles.infoPanelText}>
              • AI detects bicycles on sidewalks{'\n'}
              • You verify and add missed detections{'\n'}
              • Safety score updates based on bicycle count{'\n'}
              • Data helps create safer walking routes
            </Text>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: '#FFFFFF',
    fontSize: 16,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  instructionsContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
    borderRadius: 12,
  },
  instructionsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  instructionsText: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 18,
  },
  locationText: {
    color: '#00FF00',
    fontSize: 12,
    marginTop: 8,
    fontWeight: 'bold',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  infoPanel: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
  },
  infoPanelTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  infoPanelText: {
    color: '#CCCCCC',
    fontSize: 11,
    lineHeight: 14,
  },
  capturedImage: {
    flex: 1,
    width: '100%',
    resizeMode: 'contain',
  },
  analysisOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analysisText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  analysisSubtext: {
    color: '#CCCCCC',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  resultsOverlay: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 