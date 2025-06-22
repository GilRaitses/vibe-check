import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';

// Simple progress states for config-based analysis
export interface ConfigAnalysisProgress {
  state: 'initializing' | 'analyzing' | 'processing' | 'completed' | 'error';
  message: string;
  cameraName?: string;
  error?: string;
  completed?: boolean;
}

interface AnalysisProgressModalProps {
  visible: boolean;
  progress: ConfigAnalysisProgress | null;
  onCancel?: () => void;
  allowCancel?: boolean;
}

export default function AnalysisProgressModal({
  visible,
  progress,
  onCancel,
  allowCancel = false,
}: AnalysisProgressModalProps) {
  const getProgressIcon = () => {
    if (!progress) return '🤖';
    
    switch (progress.state) {
      case 'initializing': return '🔄';
      case 'analyzing': return '👁️';
      case 'processing': return '⚡';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '🤖';
    }
  };

  const getProgressColor = () => {
    if (!progress) return '#4A90E2';
    
    switch (progress.state) {
      case 'error': return '#FF3B30';
      case 'completed': return '#34C759';
      case 'analyzing': return '#FF9500';
      case 'processing': return '#5AC8FA';
      default: return '#4A90E2';
    }
  };

  const getProgressTitle = () => {
    if (!progress) return 'AI Analysis';
    
    switch (progress.state) {
      case 'initializing': return 'Connecting to Moondream AI';
      case 'analyzing': return 'Analyzing Camera Feed';
      case 'processing': return 'Processing Results';
      case 'completed': return 'Analysis Complete';
      case 'error': return 'Analysis Failed';
      default: return 'AI Analysis';
    }
  };

  const showSpinner = progress && !progress.completed && progress.state !== 'error';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header with Icon */}
          <View style={styles.header}>
            <Text style={styles.icon}>{getProgressIcon()}</Text>
            <Text style={styles.title}>{getProgressTitle()}</Text>
            {progress?.cameraName && (
              <Text style={styles.subtitle}>{progress.cameraName}</Text>
            )}
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            {showSpinner && (
              <ActivityIndicator
                size="large"
                color={getProgressColor()}
                style={styles.spinner}
              />
            )}
            
            {/* Simple Status Bar */}
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: getProgressColor() }]} />
              <Text style={[styles.statusText, { color: getProgressColor() }]}>
                {progress?.message || 'Preparing analysis...'}
              </Text>
            </View>
          </View>

          {/* Error Message */}
          {progress?.error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{progress.error}</Text>
            </View>
          )}

          {/* Cancel Button */}
          {allowCancel && onCancel && !progress?.completed && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}

          {/* Close Button for Completed/Error */}
          {(progress?.completed || progress?.error) && onCancel && (
            <TouchableOpacity
              style={[styles.cancelButton, styles.closeButton]}
              onPress={onCancel}
            >
              <Text style={[styles.cancelButtonText, styles.closeButtonText]}>
                {progress.completed ? 'Close' : 'Dismiss'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 350,
    borderWidth: 1,
    borderColor: '#333333',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 32,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  spinner: {
    marginBottom: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    lineHeight: 20,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    borderColor: '#34C759',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  closeButtonText: {
    color: '#34C759',
  },
}); 