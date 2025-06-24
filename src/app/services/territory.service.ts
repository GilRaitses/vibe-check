import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface Territory {
  territoryId: string;
  name: string;
  safetyScore: number;
  lastUpdated: number;
  totalAnalyses: number;
  totalReports: number;
  recentAnalyses: any[];
  recentReports: any[];
  description: string;
  safetyClass: string;
  latitude: number;
  longitude: number;
  zone_id: string;
  borough: string;
}

export interface CameraData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: string;
  lastSeen: number;
  location: { lat: number; lng: number; };
}

@Injectable({
  providedIn: 'root'
})
export class TerritoryService {
  private apiUrl = 'https://us-central1-vibe-check-463816.cloudfunctions.net/api';

  constructor(private http: HttpClient) {}

  /**
   * Get camera zone data (replaces territory analysis)
   */
  getCameraZones(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/dashboard/camera-zones`);
  }

  /**
   * Get map zones data
   */
  getMapZones(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/dashboard/map-zones`);
  }

  /**
   * Get monitoring status for a specific location
   */
  getLocationStatus(cameraId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/monitoring/timeseries/${cameraId}`);
  }

  /**
   * Get metrics for a location  
   */
  getLocationMetrics(location: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-metrics/${location}`);
  }

  /**
   * Get territory analysis for a specific camera zone (REAL DATA)
   */
  getTerritoryAnalysis(territoryId: string): Observable<Territory> {
    return this.getCameraZones().pipe(
      map(response => {
        const zone = response.zones?.find((z: any) => z.id === territoryId || z.zone_id === territoryId);
        if (!zone) {
          throw new Error(`Territory ${territoryId} not found`);
        }
        
        return {
          territoryId: zone.id,
          name: zone.name,
          safetyScore: zone.current_score || 0,
          lastUpdated: Date.now(),
          totalAnalyses: 0, // Will be populated by separate metrics call
          totalReports: 0,
          recentAnalyses: [],
          recentReports: [],
          description: `${zone.neighborhood} camera zone - ${zone.frequency_tier} monitoring`,
          safetyClass: zone.is_high_risk ? 'low' : zone.current_score >= 8 ? 'high' : 'medium',
          latitude: zone.latitude,
          longitude: zone.longitude,
          zone_id: zone.zone_id,
          borough: zone.neighborhood
        } as Territory;
      })
    );
  }

  /**
   * Get all territories from REAL camera zone data
   */
  getAllTerritories(): Observable<Territory[]> {
    return this.getCameraZones().pipe(
      map(response => {
        if (!response.zones || !Array.isArray(response.zones)) {
          return [];
        }
        
        return response.zones.map((zone: any) => ({
          territoryId: zone.id,
          name: zone.name,
          safetyScore: zone.current_score || 0,
          lastUpdated: Date.now(),
          totalAnalyses: 0, // Could be enhanced with metrics data
          totalReports: 0,
          recentAnalyses: [],
          recentReports: [],
          description: `${zone.neighborhood} camera zone - ${zone.frequency_tier} monitoring`,
          safetyClass: zone.is_high_risk ? 'low' : zone.current_score >= 8 ? 'high' : 'medium',
          latitude: zone.latitude,
          longitude: zone.longitude,
          zone_id: zone.zone_id,
          borough: zone.neighborhood
        } as Territory));
      })
    );
  }
} 