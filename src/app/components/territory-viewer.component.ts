import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TerritoryService, Territory } from '../services/territory.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-territory-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="territory-viewer">
      <h2>Territory Safety Analysis</h2>
      
      <div class="territory-selection">
        <label for="territory-select">Select Territory:</label>
        <select id="territory-select" (change)="onTerritoryChange($event)">
          <option value="">Select a territory...</option>
          <option value="manhattan-lower">Lower Manhattan</option>
          <option value="manhattan-midtown">Midtown Manhattan</option>
          <option value="brooklyn-williamsburg">Williamsburg, Brooklyn</option>
          <option value="queens-astoria">Astoria, Queens</option>
        </select>
      </div>

      <div *ngIf="selectedTerritory" class="territory-details">
        <div class="safety-score-card">
          <h3>Safety Score</h3>
          <div class="score" [class]="getScoreClass(selectedTerritory.safetyScore)">
            {{ selectedTerritory.safetyScore }}/10
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <h4>Total Analyses</h4>
            <p>{{ selectedTerritory.totalAnalyses }}</p>
          </div>
          <div class="stat-card">
            <h4>Total Reports</h4>
            <p>{{ selectedTerritory.totalReports }}</p>
          </div>
          <div class="stat-card">
            <h4>Last Updated</h4>
            <p>{{ formatTimestamp(selectedTerritory.lastUpdated) }}</p>
          </div>
        </div>

        <div class="recent-analyses" *ngIf="selectedTerritory.recentAnalyses.length > 0">
          <h4>Recent Analyses</h4>
          <div class="analysis-list">
            <div *ngFor="let analysis of selectedTerritory.recentAnalyses" class="analysis-item">
              <span class="timestamp">{{ formatTimestamp(analysis.timestamp) }}</span>
              <span class="score">Score: {{ analysis.analysis?.safetyScore || 'N/A' }}</span>
              <span class="risk" [class]="analysis.analysis?.riskLevel">
                {{ analysis.analysis?.riskLevel || 'Unknown' }}
              </span>
            </div>
          </div>
        </div>

        <div class="recent-reports" *ngIf="selectedTerritory.recentReports.length > 0">
          <h4>Recent Reports</h4>
          <div class="report-list">
            <div *ngFor="let report of selectedTerritory.recentReports" class="report-item">
              <span class="timestamp">{{ formatTimestamp(report.timestamp) }}</span>
              <span class="type">{{ report.reportType }}</span>
              <span class="severity" [class]="report.severity">
                {{ report.severity || 'medium' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="loading" class="loading">
        Loading territory data...
      </div>

      <div *ngIf="error" class="error">
        Error loading territory data: {{ error }}
      </div>
    </div>
  `,
  styles: [`
    .territory-viewer {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .territory-selection {
      margin-bottom: 20px;
    }

    .territory-selection label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
    }

    .territory-selection select {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
      min-width: 200px;
    }

    .safety-score-card {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin-bottom: 20px;
    }

    .score {
      font-size: 48px;
      font-weight: bold;
      margin-top: 10px;
    }

    .score.high { color: #28a745; }
    .score.medium { color: #ffc107; }
    .score.low { color: #dc3545; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }

    .stat-card h4 {
      margin: 0 0 8px 0;
      color: #6c757d;
      font-size: 14px;
      text-transform: uppercase;
    }

    .stat-card p {
      margin: 0;
      font-size: 24px;
      font-weight: bold;
    }

    .recent-analyses, .recent-reports {
      margin-bottom: 20px;
    }

    .analysis-list, .report-list {
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      overflow: hidden;
    }

    .analysis-item, .report-item {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 16px;
      padding: 12px 16px;
      border-bottom: 1px solid #f1f3f4;
      align-items: center;
    }

    .analysis-item:last-child, .report-item:last-child {
      border-bottom: none;
    }

    .timestamp {
      color: #6c757d;
      font-size: 14px;
    }

    .risk.low, .severity.low { 
      color: #28a745; 
      font-weight: bold;
    }
    .risk.moderate, .severity.medium { 
      color: #ffc107; 
      font-weight: bold;
    }
    .risk.high, .severity.high { 
      color: #fd7e14; 
      font-weight: bold;
    }
    .risk.critical, .severity.critical { 
      color: #dc3545; 
      font-weight: bold;
    }

    .loading, .error {
      text-align: center;
      padding: 40px;
      color: #6c757d;
    }

    .error {
      color: #dc3545;
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
    }
  `]
})
export class TerritoryViewerComponent implements OnInit {
  selectedTerritory: Territory | null = null;
  loading = false;
  error: string | null = null;

  constructor(private territoryService: TerritoryService) {}

  ngOnInit() {
    // Component initialization
  }

  onTerritoryChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const territoryId = select.value;
    
    if (territoryId) {
      this.loadTerritoryData(territoryId);
    } else {
      this.selectedTerritory = null;
    }
  }

  loadTerritoryData(territoryId: string) {
    this.loading = true;
    this.error = null;

    this.territoryService.getTerritoryAnalysis(territoryId).subscribe({
      next: (territory) => {
        this.selectedTerritory = territory;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load territory data';
        this.loading = false;
        console.error('Territory loading error:', err);
      }
    });
  }

  getScoreClass(score: number): string {
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }

  formatTimestamp(timestamp: any): string {
    if (!timestamp) return 'Unknown';
    
    // Handle Firestore Timestamp objects
    if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleString();
    }
    
    // Handle regular timestamps
    if (typeof timestamp === 'number') {
      return new Date(timestamp).toLocaleString();
    }
    
    return 'Unknown';
  }
} 