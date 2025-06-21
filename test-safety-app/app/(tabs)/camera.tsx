import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Image, Alert, Dimensions, ActivityIndicator, Modal, Pressable } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafety } from '@/components/SafetyContext';
import * as Location from 'expo-location';
import MoondreamService, { BicycleDetectionResult, DetectedObject } from '@/services/moondreamService';
import BicycleDetectionOverlay from '@/components/BicycleDetectionOverlay';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const imageWidth = screenWidth * 0.9;
const imageHeight = 400;

interface Block {
  id: number;
  lat: number;
  lng: number;
  score: number;
}

interface CustomModalProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: Array<{
    text: string;
    onPress: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
  onClose: () => void;
}

const CustomModal: React.FC<CustomModalProps> = ({ visible, title, message, buttons, onClose }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <View style={styles.modalButtonContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.modalButton,
                  button.style === 'cancel' && styles.modalButtonCancel,
                  button.style === 'destructive' && styles.modalButtonDestructive,
                ]}
                onPress={() => {
                  button.onPress();
                  onClose();
                }}
              >
                <Text style={[
                  styles.modalButtonText,
                  button.style === 'cancel' && styles.modalButtonTextCancel,
                  button.style === 'destructive' && styles.modalButtonTextDestructive,
                ]}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function CameraScreen() {
  const { blocks, updateBlockSafety } = useSafety();
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [nearestBlock, setNearestBlock] = useState<Block | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectionResult, setDetectionResult] = useState<BicycleDetectionResult | null>(null);
  const [showVerificationOverlay, setShowVerificationOverlay] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [showContextPanel, setShowContextPanel] = useState(false);
  
  // Custom modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalButtons, setModalButtons] = useState<Array<{
    text: string;
    onPress: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>>([]);
  
  const cameraRef = useRef<CameraView | null>(null);

  const showCustomAlert = (title: string, message: string, buttons: Array<{
    text: string;
    onPress: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalButtons(buttons);
    setModalVisible(true);
  };

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
        showCustomAlert(
          'Permission Denied',
          'Location permission is required for safety mapping.',
          [{ text: 'OK', onPress: () => {} }]
        );
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
      showCustomAlert(
        'Location Error',
        'Could not get current location.',
        [{ text: 'OK', onPress: () => {} }]
      );
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) {
      showCustomAlert(
        'Error',
        'Camera not ready',
        [{ text: 'OK', onPress: () => {} }]
      );
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6, // Reduced quality for better network performance
        base64: false,
        exif: false,
        skipProcessing: false, // Allow processing for compression
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
          console.log('🔍 [HACKATHON] Starting camera image analysis...');
          const result = await MoondreamService.detectBicycles(photo.uri);
          setDetectionResult(result);
          setIsAnalyzing(false);
          
          if (result.totalCount > 0) {
            // Show verification overlay
            setShowVerificationOverlay(true);
          } else {
            // No active cyclists detected, show context about what was detected
            const message = result.hasSidewalk 
              ? `✅ Sidewalk/pavement detected!\n\n🚴‍♀️ No people riding bicycles found on the sidewalk.\n\nScene: ${result.sceneDescription}\n\nThis indicates a safe area for pedestrians.`
              : `❓ No clear sidewalk detected in this image.\n\nScene: ${result.sceneDescription}\n\nTry pointing the camera at a sidewalk or pedestrian area.`;
            
            showCustomAlert(
              result.hasSidewalk ? 'Safe Sidewalk Detected!' : 'No Sidewalk Detected',
              message,
              [
                {
                  text: 'Add Cyclists Manually',
                  onPress: () => setShowVerificationOverlay(true)
                },
                {
                  text: result.hasSidewalk ? 'Confirm - Safe Area' : 'Try Again',
                  onPress: () => result.hasSidewalk ? handleVerificationComplete([], []) : resetCamera()
                }
              ]
            );
          }
        } catch (error: any) {
          setIsAnalyzing(false);
          console.error('❌ [HACKATHON] Error analyzing camera image:', error);
          
          // Show user-friendly error message based on error type
          let errorTitle = 'Analysis Failed';
          let errorMessage = 'Could not analyze the image. You can still manually mark bicycles.';
          
          if (error?.message?.includes('timed out')) {
            errorTitle = '⏱️ Network Timeout';
            errorMessage = 'The analysis took too long. This usually happens with poor network connection.\n\n📶 Try moving to better network coverage and retaking the photo.';
          } else if (error?.message?.includes('network') || error?.message?.includes('connection')) {
            errorTitle = '📶 Network Error';
            errorMessage = 'Could not connect to analysis service.\n\nPlease check your internet connection and try again.';
          } else if (error?.message?.includes('process image')) {
            errorTitle = '📸 Image Processing Error';
            errorMessage = 'Could not process the image.\n\nTry taking a new photo with better lighting.';
          }
          
          showCustomAlert(
            errorTitle,
            errorMessage,
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
              { text: 'Retake Photo', onPress: () => setCapturedPhoto(null) },
              { text: 'Cancel', onPress: () => setCapturedPhoto(null) }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      showCustomAlert(
        'Error',
        'Failed to take picture',
        [{ text: 'OK', onPress: () => {} }]
      );
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
    showCustomAlert(
      'Safety Assessment Complete',
      `Detected ${totalBicycles} active cyclist(s) on sidewalk.\nSafety Score: ${safetyScore}/10\n\nThis location has been updated on the safety map.`,
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
    console.log('🔄 [HACKATHON] Resetting camera state...');
    setCapturedPhoto(null);
    setDetectionResult(null);
    setShowVerificationOverlay(false);
    setIsAnalyzing(false);
    setImageSize({ width: 0, height: 0 });
    setShowContextPanel(false);
    console.log('✅ [HACKATHON] Camera state reset complete');
  };

  const forceResetCamera = () => {
    console.log('🚨 [HACKATHON] Force resetting camera due to stuck state...');
    resetCamera();
    showCustomAlert(
      'Camera Reset',
      'Camera has been reset due to stuck state. You can now take a new photo.',
      [{ text: 'OK', onPress: () => {} }]
    );
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

  if (showVerificationOverlay && capturedPhoto && detectionResult) {
    return (
      <View style={styles.container}>
        <Image 
          source={{ uri: capturedPhoto }} 
          style={[styles.capturedImage, { width: imageSize.width, height: imageSize.height }]}
          resizeMode="contain"
        />
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

  return (
    <View style={styles.container}>
      {/* Full Screen Camera View */}
      <View style={styles.fullScreenCameraContainer}>
        {capturedPhoto ? (
          <Pressable 
            style={styles.previewContainer}
            onPress={() => {
              // Single tap does nothing, but allows double tap detection
            }}
            onLongPress={forceResetCamera}
            delayLongPress={1000}
          >
            <Image source={{ uri: capturedPhoto }} style={styles.preview} />
            {isAnalyzing && (
              <View style={styles.analyzingOverlay}>
                <ActivityIndicator size="large" color="#00AA00" />
                <Text style={styles.analyzingText}>Analyzing with Moondream AI...</Text>
                <Text style={styles.analyzingSubtext}>Long press to force reset if stuck</Text>
              </View>
            )}
            {!isAnalyzing && (
              <View style={styles.previewInstructions}>
                <Text style={styles.previewInstructionsText}>
                  Long press image to force reset if stuck
                </Text>
              </View>
            )}
          </Pressable>
        ) : (
          <CameraView 
            ref={cameraRef}
            style={styles.camera}
            facing="back"
          />
        )}
      </View>

      {/* Top Controls Overlay */}
      <View style={styles.topOverlay}>
        <TouchableOpacity 
          style={styles.infoButton}
          onPress={() => setShowContextPanel(!showContextPanel)}
        >
          <Text style={styles.infoButtonText}>
            {showContextPanel ? '✕' : 'ℹ️'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.scoreOverlay}>
          📍 Safety: {nearestBlock?.score || 5}/10
        </Text>
      </View>

      {/* Bottom Controls Overlay */}
      <View style={styles.bottomOverlay}>
        {capturedPhoto ? (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.retakeButton} onPress={resetCamera}>
              <Text style={styles.retakeButtonText}>↻ Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearButton} onPress={resetCamera}>
              <Text style={styles.clearButtonText}>✕ Clear</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        )}
      </View>

      {/* Collapsible Context Panel */}
      {showContextPanel && (
        <View style={styles.contextPanel}>
          <View style={styles.contextHeader}>
            <Text style={styles.contextTitle}>🚴‍♀️ Cyclist Safety Detection</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowContextPanel(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.contextSubtitle}>
            Point camera at sidewalk to detect people riding bicycles
          </Text>
          <View style={styles.contextInstructions}>
            <Text style={styles.contextInstructionsTitle}>How it works:</Text>
            <Text style={styles.contextInstructionsText}>
              • Point camera at sidewalk or pedestrian area{'\n'}
              • AI detects people actively riding bicycles{'\n'}
              • Ignores parked/stationary bicycles{'\n'}
              • Safety score based on active cyclist count
            </Text>
          </View>
        </View>
      )}

      {/* Custom Modal */}
      <CustomModal
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        buttons={modalButtons}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullScreenCameraContainer: {
    flex: 1,
  },
  topOverlay: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  infoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  scoreOverlay: {
    fontSize: 16,
    color: '#00FF00',
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  retakeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  retakeButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.9)', // Red background
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contextPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
    zIndex: 2,
  },
  contextHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contextTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  contextSubtitle: {
    fontSize: 16,
    color: '#CCCCCC',
    marginBottom: 16,
  },
  contextInstructions: {
    marginTop: 8,
  },
  contextInstructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  contextInstructionsText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 12,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  scoreText: {
    fontSize: 16,
    color: '#00FF00',
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
  },
  preview: {
    flex: 1,
    width: '100%',
    resizeMode: 'contain', // Maintain aspect ratio without cropping
  },
  capturedImage: {
    alignSelf: 'center',
  },
  analyzingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  analyzingSubtext: {
    color: '#CCCCCC',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  previewInstructions: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    padding: 12,
  },
  previewInstructionsText: {
    color: '#CCCCCC',
    fontSize: 14,
    textAlign: 'center',
  },
  controls: {
    paddingVertical: 30,
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
  buttonRow: {
    flexDirection: 'row',
    gap: 20,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#666666',
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructions: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  message: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Custom Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    maxWidth: screenWidth * 0.9,
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  modalButtonContainer: {
    flexDirection: 'column',
    gap: 10,
  },
  modalButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#8E8E93',
  },
  modalButtonDestructive: {
    backgroundColor: '#FF3B30',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalButtonTextCancel: {
    color: '#FFFFFF',
  },
  modalButtonTextDestructive: {
    color: '#FFFFFF',
  },
}); 