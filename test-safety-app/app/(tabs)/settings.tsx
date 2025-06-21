import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import NYCCameraService from '@/services/nycCameraService';

export default function SettingsScreen() {
  const [settings, setSettings] = useState({
    autoAnalysis: true,
    showCameraMarkers: true,
    heatMapEnabled: true,
    highQualityAnalysis: false,
    backgroundUpdates: true,
    dataUsageOptimized: true,
    disableTimeouts: false,
    detailedProgress: true,
  });

  const [cacheInfo, setCacheInfo] = useState({
    cameras: 0,
    analyses: 0,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const clearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will remove all cached camera data and analyses. The app will need to re-download data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            NYCCameraService.clearCache();
            setCacheInfo({ cameras: 0, analyses: 0 });
            Alert.alert('Success', 'Cache cleared successfully');
          }
        }
      ]
    );
  };

  const refreshCameraData = async () => {
    try {
      const cameras = await NYCCameraService.fetchCameras();
      Alert.alert('Success', `Loaded ${cameras.length} cameras from NYC API`);
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh camera data');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>⚙️ Settings</Text>
          <Text style={styles.subtitle}>Configure your safety analysis preferences</Text>
        </View>

        {/* Analysis Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤖 AI Analysis</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto-analyze nearby areas</Text>
              <Text style={styles.settingDescription}>
                Automatically analyze traffic cameras when you move to a new location
              </Text>
            </View>
            <Switch
              value={settings.autoAnalysis}
              onValueChange={() => toggleSetting('autoAnalysis')}
              trackColor={{ false: '#767577', true: '#4A90E2' }}
              thumbColor={settings.autoAnalysis ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>High-quality analysis</Text>
              <Text style={styles.settingDescription}>
                Use more detailed AI questions for better accuracy (slower)
              </Text>
            </View>
            <Switch
              value={settings.highQualityAnalysis}
              onValueChange={() => toggleSetting('highQualityAnalysis')}
              trackColor={{ false: '#767577', true: '#4A90E2' }}
              thumbColor={settings.highQualityAnalysis ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Background updates</Text>
              <Text style={styles.settingDescription}>
                Continue analyzing when app is in background
              </Text>
            </View>
            <Switch
              value={settings.backgroundUpdates}
              onValueChange={() => toggleSetting('backgroundUpdates')}
              trackColor={{ false: '#767577', true: '#4A90E2' }}
              thumbColor={settings.backgroundUpdates ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Disable API timeouts</Text>
              <Text style={styles.settingDescription}>
                Remove time limits for slower connections (may cause hanging)
              </Text>
            </View>
            <Switch
              value={settings.disableTimeouts}
              onValueChange={() => toggleSetting('disableTimeouts')}
              trackColor={{ false: '#767577', true: '#FF9500' }}
              thumbColor={settings.disableTimeouts ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Detailed progress tracking</Text>
              <Text style={styles.settingDescription}>
                Show step-by-step progress during analysis
              </Text>
            </View>
            <Switch
              value={settings.detailedProgress}
              onValueChange={() => toggleSetting('detailedProgress')}
              trackColor={{ false: '#767577', true: '#4A90E2' }}
              thumbColor={settings.detailedProgress ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Map Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🗺️ Map Display</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Show camera markers</Text>
              <Text style={styles.settingDescription}>
                Display NYC traffic camera locations on the map
              </Text>
            </View>
            <Switch
              value={settings.showCameraMarkers}
              onValueChange={() => toggleSetting('showCameraMarkers')}
              trackColor={{ false: '#767577', true: '#4A90E2' }}
              thumbColor={settings.showCameraMarkers ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Heat map overlay</Text>
              <Text style={styles.settingDescription}>
                Show risk level heat map based on analysis results
              </Text>
            </View>
            <Switch
              value={settings.heatMapEnabled}
              onValueChange={() => toggleSetting('heatMapEnabled')}
              trackColor={{ false: '#767577', true: '#4A90E2' }}
              thumbColor={settings.heatMapEnabled ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Data Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Data Management</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Optimize data usage</Text>
              <Text style={styles.settingDescription}>
                Reduce API calls and cache more aggressively
              </Text>
            </View>
            <Switch
              value={settings.dataUsageOptimized}
              onValueChange={() => toggleSetting('dataUsageOptimized')}
              trackColor={{ false: '#767577', true: '#4A90E2' }}
              thumbColor={settings.dataUsageOptimized ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>

          <TouchableOpacity style={styles.actionButton} onPress={refreshCameraData}>
            <Text style={styles.actionButtonText}>🔄 Refresh Camera Data</Text>
            <Text style={styles.actionButtonSubtext}>Re-download from NYC API</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={clearCache}>
            <Text style={[styles.actionButtonText, styles.dangerText]}>🗑️ Clear Cache</Text>
            <Text style={[styles.actionButtonSubtext, styles.dangerText]}>
              Remove all stored data
            </Text>
          </TouchableOpacity>
        </View>

        {/* Data Sources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔗 Data Sources</Text>
          
          <View style={styles.dataSource}>
            <Text style={styles.dataSourceTitle}>NYC Traffic Management Center</Text>
            <Text style={styles.dataSourceUrl}>nyctmc.org/api/camera</Text>
            <Text style={styles.dataSourceDescription}>
              Official NYC traffic camera feeds with ~940 cameras across all boroughs
            </Text>
          </View>

          <View style={styles.dataSource}>
            <Text style={styles.dataSourceTitle}>Moondream AI</Text>
            <Text style={styles.dataSourceUrl}>moondream.ai</Text>
            <Text style={styles.dataSourceDescription}>
              Computer vision API for analyzing traffic cameras and user photos
            </Text>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ About</Text>
          
          <View style={styles.aboutInfo}>
            <Text style={styles.aboutTitle}>NYC Sidewalk Safety</Text>
            <Text style={styles.aboutVersion}>Version 1.0.0</Text>
            <Text style={styles.aboutDescription}>
              This app uses AI to analyze NYC traffic cameras and user-submitted photos to create 
              a real-time safety map for pedestrians. By identifying bicycles on sidewalks, 
              delivery trucks, and other hazards, we help create safer walking routes throughout 
              the city.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Built for safer streets in NYC 🗽
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    marginTop: 4,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#CCCCCC',
    lineHeight: 16,
  },
  actionButton: {
    backgroundColor: 'rgba(74, 144, 226, 0.2)',
    borderWidth: 1,
    borderColor: '#4A90E2',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
  },
  dangerButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderColor: '#FF3B30',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 4,
  },
  actionButtonSubtext: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  dangerText: {
    color: '#FF3B30',
  },
  dataSource: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  dataSourceTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  dataSourceUrl: {
    fontSize: 12,
    color: '#4A90E2',
    marginBottom: 8,
  },
  dataSourceDescription: {
    fontSize: 11,
    color: '#CCCCCC',
    lineHeight: 14,
  },
  aboutInfo: {
    alignItems: 'center',
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  aboutVersion: {
    fontSize: 12,
    color: '#CCCCCC',
    marginBottom: 16,
  },
  aboutDescription: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
    textAlign: 'center',
  },
  footer: {
    padding: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
}); 