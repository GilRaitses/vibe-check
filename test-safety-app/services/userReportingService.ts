/**
 * User Reporting Service
 * Handles user-uploaded photos of sidewalk violations
 * Generates 311 reports and updates block scores
 */

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  SidewalkViolationMatrix, 
  SIDEWALK_VIOLATION_PROMPT,
  parseSidewalkViolationResponse,
  calculateViolationScore,
  generate311Report
} from '../config/sidewalkViolationConfig';

export interface ViolationReport {
  id: string;
  timestamp: Date;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  photoUri: string;
  matrix: SidewalkViolationMatrix;
  score: number;
  report311: string;
  blockId: string;
}

class UserReportingService {
  private static instance: UserReportingService;
  
  static getInstance(): UserReportingService {
    if (!UserReportingService.instance) {
      UserReportingService.instance = new UserReportingService();
    }
    return UserReportingService.instance;
  }

  /**
   * Process user-uploaded photo of sidewalk violation
   */
  async reportSidewalkViolation(photoUri: string): Promise<ViolationReport> {
    try {
      console.log('📸 Processing user violation report...');
      
      // Get current location
      const location = await this.getCurrentLocation();
      
      // Analyze photo with specialized violation config
      const matrix = await this.analyzeViolationPhoto(photoUri);
      
      // Calculate violation score
      const score = calculateViolationScore(matrix);
      
      // Generate 311 report
      const report311 = generate311Report(matrix, location.address, new Date());
      
      // Create violation report
      const report: ViolationReport = {
        id: `violation_${Date.now()}`,
        timestamp: new Date(),
        location,
        photoUri,
        matrix,
        score,
        report311,
        blockId: this.getBlockId(location.latitude, location.longitude)
      };
      
      // Save report
      await this.saveViolationReport(report);
      
      // Update block score
      await this.updateBlockScore(report.blockId, score);
      
      console.log('✅ Violation report processed:', {
        score: score.toFixed(1),
        location: location.address,
        severity: score > 7 ? 'HIGH' : score > 4 ? 'MEDIUM' : 'LOW'
      });
      
      return report;
      
    } catch (error) {
      console.error('❌ Error processing violation report:', error);
      throw error;
    }
  }

  /**
   * Analyze violation photo using Moondream API
   */
  private async analyzeViolationPhoto(photoUri: string): Promise<SidewalkViolationMatrix> {
    try {
      // Convert image to base64
      const base64 = await this.imageUriToBase64(photoUri);
      
      // Call Moondream API with specialized prompt
      const response = await fetch('https://api.moondream.ai/v1/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_MOONDREAM_API_KEY}`
        },
        body: JSON.stringify({
          image: base64,
          question: SIDEWALK_VIOLATION_PROMPT
        })
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('🔢 Raw violation analysis:', data.answer);
      
      // Parse response into feature matrix
      return parseSidewalkViolationResponse(data.answer);
      
    } catch (error) {
      console.error('❌ Violation photo analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get current location with address
   */
  private async getCurrentLocation(): Promise<{latitude: number, longitude: number, address: string}> {
    const location = await Location.getCurrentPositionAsync({});
    
    // Reverse geocode to get address
    const addresses = await Location.reverseGeocodeAsync({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    });
    
    const address = addresses[0] ? 
      `${addresses[0].street} ${addresses[0].streetNumber}, ${addresses[0].city}` :
      `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`;
    
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      address
    };
  }

  /**
   * Convert image URI to base64
   */
  private async imageUriToBase64(uri: string): Promise<string> {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Generate block ID from coordinates
   */
  private getBlockId(lat: number, lng: number): string {
    // Round to ~100m precision for block-level grouping
    const blockLat = Math.round(lat * 1000) / 1000;
    const blockLng = Math.round(lng * 1000) / 1000;
    return `block_${blockLat}_${blockLng}`;
  }

  /**
   * Save violation report to AsyncStorage
   */
  private async saveViolationReport(report: ViolationReport): Promise<void> {
    try {
      // Save individual report
      await AsyncStorage.setItem(`violation_${report.id}`, JSON.stringify(report));
      
      // Update reports index
      const existingReports = await this.getAllViolationReports();
      const updatedReports = [...existingReports, report.id];
      await AsyncStorage.setItem('violation_reports_index', JSON.stringify(updatedReports));
      
    } catch (error) {
      console.error('❌ Error saving violation report:', error);
      throw error;
    }
  }

  /**
   * Update block score based on violation
   */
  private async updateBlockScore(blockId: string, violationScore: number): Promise<void> {
    try {
      const key = `block_score_${blockId}`;
      const existing = await AsyncStorage.getItem(key);
      
      let blockData = existing ? JSON.parse(existing) : {
        blockId,
        violationCount: 0,
        totalScore: 0,
        averageScore: 0,
        lastUpdated: new Date().toISOString()
      };
      
      // Update with new violation
      blockData.violationCount += 1;
      blockData.totalScore += violationScore;
      blockData.averageScore = blockData.totalScore / blockData.violationCount;
      blockData.lastUpdated = new Date().toISOString();
      
      await AsyncStorage.setItem(key, JSON.stringify(blockData));
      
      console.log('📊 Updated block score:', {
        blockId,
        violations: blockData.violationCount,
        avgScore: blockData.averageScore.toFixed(1)
      });
      
    } catch (error) {
      console.error('❌ Error updating block score:', error);
    }
  }

  /**
   * Get all violation reports
   */
  async getAllViolationReports(): Promise<string[]> {
    try {
      const index = await AsyncStorage.getItem('violation_reports_index');
      return index ? JSON.parse(index) : [];
    } catch (error) {
      console.error('❌ Error getting violation reports:', error);
      return [];
    }
  }

  /**
   * Get violation report by ID
   */
  async getViolationReport(id: string): Promise<ViolationReport | null> {
    try {
      const report = await AsyncStorage.getItem(`violation_${id}`);
      return report ? JSON.parse(report) : null;
    } catch (error) {
      console.error('❌ Error getting violation report:', error);
      return null;
    }
  }

  /**
   * Export 311 reports for a date range
   */
  async export311Reports(startDate: Date, endDate: Date): Promise<string> {
    try {
      const reportIds = await this.getAllViolationReports();
      const reports: ViolationReport[] = [];
      
      for (const id of reportIds) {
        const report = await this.getViolationReport(id);
        if (report && report.timestamp >= startDate && report.timestamp <= endDate) {
          reports.push(report);
        }
      }
      
      // Generate consolidated 311 export
      const exportData = reports.map(report => ({
        id: report.id,
        timestamp: report.timestamp.toISOString(),
        location: report.location.address,
        latitude: report.location.latitude,
        longitude: report.location.longitude,
        violationScore: report.score.toFixed(1),
        report: report.report311
      }));
      
      return JSON.stringify(exportData, null, 2);
      
    } catch (error) {
      console.error('❌ Error exporting 311 reports:', error);
      throw error;
    }
  }

  /**
   * Get block violation statistics
   */
  async getBlockStats(): Promise<any[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const blockKeys = keys.filter(key => key.startsWith('block_score_'));
      
      const stats = [];
      for (const key of blockKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          stats.push(JSON.parse(data));
        }
      }
      
      return stats.sort((a, b) => b.averageScore - a.averageScore);
      
    } catch (error) {
      console.error('❌ Error getting block stats:', error);
      return [];
    }
  }
}

export default UserReportingService; 