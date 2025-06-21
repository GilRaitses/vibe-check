import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { AnalysisProgress } from '@/services/moondreamService';

interface AnalysisProgressModalProps {
  visible: boolean;
  progress: AnalysisProgress | null;
  onCancel?: () => void;
  allowCancel?: boolean;
}

export default function AnalysisProgressModal({
  visible,
  progress,
  onCancel,
  allowCancel = false,
}: AnalysisProgressModalProps) {
  const getProgressPercentage = () => {
    if (!progress) return 0;
    return Math.round((progress.step / progress.totalSteps) * 100);
  };

  const getProgressColor = () => {
    if (!progress) return '#4A90E2';
    if (progress.error) return '#FF3B30';
    if (progress.completed) return '#34C759';
    return '#4A90E2';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🤖 AI Analysis</Text>
            {progress && (
              <Text style={styles.subtitle}>
                Step {progress.step} of {progress.totalSteps}
              </Text>
            )}
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${getProgressPercentage()}%`,
                    backgroundColor: getProgressColor(),
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {getProgressPercentage()}%
            </Text>
          </View>

          {/* Current Step */}
          {progress && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeader}>
                {!progress.completed && !progress.error && (
                  <ActivityIndicator
                    size="small"
                    color="#4A90E2"
                    style={styles.spinner}
                  />
                )}
                <Text style={[
                  styles.stepTitle,
                  progress.error && styles.errorText,
                  progress.completed && styles.successText,
                ]}>
                  {progress.error ? '❌ Error' : progress.completed ? '✅ Complete' : progress.currentStep}
                </Text>
              </View>
              <Text style={styles.stepDescription}>
                {progress.error || progress.description}
              </Text>
            </View>
          )}

          {/* Step Progress Indicators */}
          {progress && (
            <View style={styles.stepsContainer}>
              {Array.from({ length: progress.totalSteps }, (_, index) => {
                const stepNumber = index + 1;
                const isCompleted = stepNumber < progress.step;
                const isCurrent = stepNumber === progress.step;
                const isError = progress.error && isCurrent;

                return (
                  <View
                    key={stepNumber}
                    style={[
                      styles.stepIndicator,
                      isCompleted && styles.stepCompleted,
                      isCurrent && styles.stepCurrent,
                      isError && styles.stepError,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stepNumber,
                        (isCompleted || isCurrent) && styles.stepNumberActive,
                        isError && styles.stepNumberError,
                      ]}
                    >
                      {stepNumber}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Cancel Button */}
          {allowCancel && onCancel && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333333',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#CCCCCC',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    minWidth: 40,
    textAlign: 'right',
  },
  stepContainer: {
    marginBottom: 20,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  spinner: {
    marginRight: 8,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stepDescription: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  errorText: {
    color: '#FF3B30',
  },
  successText: {
    color: '#34C759',
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: '#333333',
  },
  stepCompleted: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  stepCurrent: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  stepError: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666666',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepNumberError: {
    color: '#FFFFFF',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
}); 