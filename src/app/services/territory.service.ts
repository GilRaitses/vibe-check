import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Territory {
  territoryId: string;
  safetyScore: number;
  totalAnalyses: number;
  totalReports: number;
  recentAnalyses: any[];
  recentReports: any[];
  lastUpdated: number;
  coordinates?: google.maps.LatLng[]; // For map component
}

export interface Analysis {
  id: string;
  timestamp: number;
  location: {
    lat: number;
    lng: number;
    territory?: string;
  };
  safetyScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  hazards: string[];
  recommendations: string[];
  infrastructure: {
    bikeActivity: 'low' | 'medium' | 'high';
    pedestrianSpace: 'adequate' | 'crowded' | 'blocked';
    visibility: 'good' | 'fair' | 'poor';
  };
  confidence: number;
}

@Injectable({
  providedIn: 'root'
})
export class TerritoryService {
  private apiUrl = environment.production 
    ? 'https://us-central1-vibe-check-463816.cloudfunctions.net/api'
    : 'http://localhost:5001/vibe-check-463816/us-central1/api';

  constructor(private http: HttpClient) {}

  /**
   * Get territory analysis data
   */
  getTerritoryAnalysis(territoryId: string): Observable<Territory> {
    return this.http.get<Territory>(`${this.apiUrl}/territory/${territoryId}`);
  }

  /**
   * Submit image for AI analysis
   */
  analyzeImage(imageData: string, metadata: any): Observable<{ success: boolean; analysis: Analysis }> {
    return this.http.post<{ success: boolean; analysis: Analysis }>(`${this.apiUrl}/orchestrate-analysis`, {
      imageData,
      metadata
    });
  }

  /**
   * Submit user report
   */
  submitReport(reportData: {
    location: { lat: number; lng: number; territory?: string };
    reportType: string;
    description: string;
    severity?: string;
    imageData?: string;
  }): Observable<{ success: boolean; reportId: string; message: string }> {
    return this.http.post<{ success: boolean; reportId: string; message: string }>(`${this.apiUrl}/submit-report`, reportData);
  }

  /**
   * Get system status
   */
  getSystemStatus(): Observable<{
    status: string;
    metrics: {
      totalAnalyses: number;
      pendingReports: number;
      successRate: number;
      avgResponseTime: string;
      systemHealth: string;
    };
    services: {
      geminiAI: string;
      firestore: string;
      storage: string;
    };
    lastUpdated: number;
  }> {
    return this.http.get<any>(`${this.apiUrl}/status`);
  }

  /**
   * Health check
   */
  healthCheck(): Observable<{ status: string; timestamp: number; version: string }> {
    return this.http.get<{ status: string; timestamp: number; version: string }>(`${this.apiUrl}/health`);
  }

  /**
   * Get all territories (mock implementation for map component)
   */
  getAllTerritories(): Observable<Territory[]> {
    // Mock data for now - replace with actual API call when available
    const mockTerritories: Territory[] = [
      {
        territoryId: 'manhattan-lower',
        safetyScore: 7.5,
        totalAnalyses: 45,
        totalReports: 12,
        recentAnalyses: [],
        recentReports: [],
        lastUpdated: Date.now()
      },
      {
        territoryId: 'manhattan-midtown', 
        safetyScore: 6.2,
        totalAnalyses: 78,
        totalReports: 23,
        recentAnalyses: [],
        recentReports: [],
        lastUpdated: Date.now()
      },
      {
        territoryId: 'brooklyn-williamsburg',
        safetyScore: 8.1,
        totalAnalyses: 34,
        totalReports: 8,
        recentAnalyses: [],
        recentReports: [],
        lastUpdated: Date.now()
      }
    ];
    
    return new Observable(observer => {
      observer.next(mockTerritories);
      observer.complete();
    });
  }
} 