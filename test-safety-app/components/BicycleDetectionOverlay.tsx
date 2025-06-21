import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  PanResponder,
  Alert
} from 'react-native';
import Svg, { 
  Rect, 
  Circle as SvgCircle, 
  Path,
  Text as SvgText 
} from 'react-native-svg';
import { DetectedObject } from '@/services/moondreamService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface BicycleDetectionOverlayProps {
  imageWidth: number;
  imageHeight: number;
  detectedBicycles: DetectedObject[];
  detectedSidewalks?: DetectedObject[];
  onVerificationComplete: (verifiedBicycles: DetectedObject[], userAddedCircles: UserCircle[]) => void;
  onCancel: () => void;
}

interface UserCircle {
  x: number;
  y: number;
  radius: number;
}

interface DrawingPath {
  path: string;
  isComplete: boolean;
}

export default function BicycleDetectionOverlay({
  imageWidth,
  imageHeight,
  detectedBicycles,
  detectedSidewalks = [],
  onVerificationComplete,
  onCancel
}: BicycleDetectionOverlayProps) {
  const [verifiedBicycles, setVerifiedBicycles] = useState<DetectedObject[]>(detectedBicycles);
  const [userCircles, setUserCircles] = useState<UserCircle[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<DrawingPath | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  
  const drawingRef = useRef({ startX: 0, startY: 0, path: '' });

  // Calculate scale factors to convert normalized coordinates to screen coordinates
  const scaleX = imageWidth;
  const scaleY = imageHeight;

  // Pan responder for drawing circles
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => isDrawingMode,
    onMoveShouldSetPanResponder: () => isDrawingMode,
    
    onPanResponderGrant: (evt) => {
      if (!isDrawingMode) return;
      
      const { locationX, locationY } = evt.nativeEvent;
      drawingRef.current = {
        startX: locationX,
        startY: locationY,
        path: `M${locationX},${locationY}`
      };
      
      setCurrentDrawing({
        path: drawingRef.current.path,
        isComplete: false
      });
    },

    onPanResponderMove: (evt) => {
      if (!isDrawingMode || !currentDrawing) return;
      
      const { locationX, locationY } = evt.nativeEvent;
      const newPath = `${drawingRef.current.path} L${locationX},${locationY}`;
      
      setCurrentDrawing({
        path: newPath,
        isComplete: false
      });
    },

    onPanResponderRelease: () => {
      if (!isDrawingMode || !currentDrawing) return;
      
      // Complete the circle drawing
      const completedPath = `${currentDrawing.path} Z`;
      
      // Convert drawn path to a circle (simplified - just use center and radius)
      const centerX = drawingRef.current.startX;
      const centerY = drawingRef.current.startY;
      const radius = 30; // Fixed radius for simplicity
      
      const newCircle: UserCircle = {
        x: centerX / scaleX, // Normalize to 0-1 range
        y: centerY / scaleY,
        radius: radius / Math.min(scaleX, scaleY)
      };
      
      setUserCircles(prev => [...prev, newCircle]);
      setCurrentDrawing(null);
      setIsDrawingMode(false);
    }
  });

  const toggleBicycleVerification = (index: number) => {
    setVerifiedBicycles(prev => {
      const updated = [...prev];
      if (updated.includes(detectedBicycles[index])) {
        // Remove from verified list
        return updated.filter(bike => bike !== detectedBicycles[index]);
      } else {
        // Add to verified list
        updated.push(detectedBicycles[index]);
        return updated;
      }
    });
  };

  const removeUserCircle = (index: number) => {
    setUserCircles(prev => prev.filter((_, i) => i !== index));
  };

  const handleComplete = () => {
    if (verifiedBicycles.length === 0 && userCircles.length === 0) {
      Alert.alert(
        'No Bicycles Verified',
        'Are you sure there are no bicycles on the sidewalk in this image?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', onPress: () => onVerificationComplete([], []) }
        ]
      );
    } else {
      onVerificationComplete(verifiedBicycles, userCircles);
    }
  };

  return (
    <View style={styles.container}>
      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Verify Bicycle Detection</Text>
        <Text style={styles.instructionsText}>
          • Tap yellow boxes to confirm bicycles{'\n'}
          • Blue boxes show detected sidewalks{'\n'}
          • Tap "Draw Circle" to mark missed bicycles{'\n'}
          • Tap red circles to remove them
        </Text>
      </View>

      {/* Detection Overlay */}
      <View style={styles.imageContainer} {...panResponder.panHandlers}>
        <Svg
          width={imageWidth}
          height={imageHeight}
          style={styles.overlay}
        >
          {/* Detected sidewalks (bounding boxes) */}
          {detectedSidewalks.map((sidewalk, index) => {
            const x = sidewalk.x_min * scaleX;
            const y = sidewalk.y_min * scaleY;
            const width = (sidewalk.x_max - sidewalk.x_min) * scaleX;
            const height = (sidewalk.y_max - sidewalk.y_min) * scaleY;

            return (
              <React.Fragment key={`sidewalk-${index}`}>
                <Rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  stroke="#00BFFF"
                  strokeWidth={2}
                  fill="transparent"
                />
                <SvgText
                  x={x + 5}
                  y={y + 20}
                  fontSize="12"
                  fill="#00BFFF"
                  fontWeight="bold"
                >
                  Sidewalk
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Detected bicycles (bounding boxes) */}
          {detectedBicycles.map((bicycle, index) => {
            const isVerified = verifiedBicycles.includes(bicycle);
            const x = bicycle.x_min * scaleX;
            const y = bicycle.y_min * scaleY;
            const width = (bicycle.x_max - bicycle.x_min) * scaleX;
            const height = (bicycle.y_max - bicycle.y_min) * scaleY;

            return (
              <React.Fragment key={`detected-${index}`}>
                <Rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  stroke={isVerified ? '#00FF00' : '#FFFF00'}
                  strokeWidth={3}
                  fill="transparent"
                  onPress={() => toggleBicycleVerification(index)}
                />
                <SvgText
                  x={x + 5}
                  y={y + 20}
                  fontSize="14"
                  fill={isVerified ? '#00FF00' : '#FFFF00'}
                  fontWeight="bold"
                >
                  {isVerified ? '✓ Bicycle' : 'Bicycle?'}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* User-drawn circles */}
          {userCircles.map((circle, index) => (
            <SvgCircle
              key={`user-${index}`}
              cx={circle.x * scaleX}
              cy={circle.y * scaleY}
              r={circle.radius * Math.min(scaleX, scaleY)}
              stroke="#FF0000"
              strokeWidth={3}
              fill="transparent"
              onPress={() => removeUserCircle(index)}
            />
          ))}

          {/* Current drawing path */}
          {currentDrawing && (
            <Path
              d={currentDrawing.path}
              stroke="#FF0000"
              strokeWidth={2}
              fill="transparent"
            />
          )}
        </Svg>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.drawButton]}
            onPress={() => setIsDrawingMode(!isDrawingMode)}
          >
            <Text style={styles.buttonText}>
              {isDrawingMode ? 'Stop Drawing' : 'Draw Circle'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.completeButton]}
          onPress={handleComplete}
        >
          <Text style={styles.buttonText}>
            Complete Verification ({verifiedBicycles.length + userCircles.length} bicycles)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          AI Detected: {detectedBicycles.length} bicycles, {detectedSidewalks.length} sidewalks | 
          Verified: {verifiedBicycles.length} | 
          User Added: {userCircles.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  instructionsContainer: {
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
    lineHeight: 20,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
  },
  controlsContainer: {
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  drawButton: {
    backgroundColor: '#FF6B35',
  },
  cancelButton: {
    backgroundColor: '#666666',
  },
  completeButton: {
    backgroundColor: '#00AA00',
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsContainer: {
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
  },
  statsText: {
    color: '#CCCCCC',
    fontSize: 12,
  },
}); 