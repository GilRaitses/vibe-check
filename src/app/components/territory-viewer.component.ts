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
      <h2>Camera Zone Analysis</h2>
      
      <div class="territory-selection">
        <label for="territory-select">Select Zone:</label>
        <select id="territory-select" (change)="onTerritoryChange($event)">
          <option value="">Select a camera zone...</option>
          <option *ngFor="let territory of territories" [value]="territory.territoryId">
            {{territory.name}} (Safety: {{territory.safetyScore}}/10)
          </option>
        </select>
      </div>

      <div *ngIf="selectedTerritory" class="territory-details">
        <h3>{{ selectedTerritory.name }}</h3>
        
        <div class="score" [class]="getScoreClass(selectedTerritory.safetyScore)">
          {{ selectedTerritory.safetyScore }}/10
        </div>
        
        <div class="stats-grid">
          <div class="stat-item">
            <h4>Total Analyses</h4>
            <p>{{ selectedTerritory.totalAnalyses }}</p>
          </div>
          
          <div class="stat-item">
            <h4>Reports</h4>
            <p>{{ selectedTerritory.totalReports }}</p>
          </div>
          
          <div class="stat-item">
            <h4>Last Updated</h4>
            <p>{{ formatTimestamp(selectedTerritory.lastUpdated) }}</p>
          </div>
        </div>

        <div class="description">
          <h4>Area Description</h4>
          <p>{{ selectedTerritory.description }}</p>
        </div>

        <div class="zone-data" *ngIf="zoneData">
          <h4>Camera Zone Data</h4>
          <p><strong>Total Cameras:</strong> {{ zoneData.total_cameras || 'Loading...' }}</p>
          <p><strong>Active Zones:</strong> {{ zoneData.zones?.length || 'Loading...' }}</p>
        </div>
      </div>
      
      <div *ngIf="loading" class="loading">
        Loading camera zone data...
      </div>
      
      <div *ngIf="error" class="error">
        Error loading zone data: {{ error }}
      </div>
    </div>
  `,
  styles: [`
    .territory-viewer {
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }

    .territory-selection {
      margin-bottom: 2rem;
    }

    .territory-selection label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: bold;
    }

    .territory-selection select {
      padding: 0.75rem;
      font-size: 1rem;
      border: 2px solid #ddd;
      border-radius: 8px;
      background: white;
      width: 100%;
      max-width: 400px;
    }

    .territory-details {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }

    .territory-details h3 {
      margin: 0 0 1rem 0;
      font-size: 2rem;
      font-weight: 300;
    }

    .score {
      font-size: 3rem;
      font-weight: bold;
      text-align: center;
      padding: 1rem;
      border-radius: 50%;
      width: 120px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 1rem auto;
      border: 4px solid rgba(255,255,255,0.3);
    }

    .score.high {
      background: rgba(76, 175, 80, 0.3);
      border-color: #4CAF50;
    }

    .score.medium {
      background: rgba(255, 152, 0, 0.3);
      border-color: #FF9800;
    }

    .score.low {
      background: rgba(244, 67, 54, 0.3);
      border-color: #F44336;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin: 2rem 0;
    }

    .stat-item {
      background: rgba(255,255,255,0.1);
      padding: 1.5rem;
      border-radius: 10px;
      text-align: center;
      backdrop-filter: blur(10px);
    }

    .stat-item h4 {
      margin: 0 0 0.5rem 0;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.8;
    }

    .stat-item p {
      margin: 0;
      font-size: 1.8rem;
      font-weight: bold;
    }

    .description {
      background: rgba(255,255,255,0.1);
      padding: 1.5rem;
      border-radius: 10px;
      margin-top: 1.5rem;
      backdrop-filter: blur(10px);
    }

    .description h4 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .zone-data {
      background: rgba(255,255,255,0.1);
      padding: 1.5rem;
      border-radius: 10px;
      margin-top: 1.5rem;
      backdrop-filter: blur(10px);
    }

    .zone-data h4 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .loading {
      text-align: center;
      padding: 2rem;
      font-style: italic;
      color: #666;
    }

    .error {
      background: #ffebee;
      color: #c62828;
      border: 1px solid #ffcdd2;
      border-radius: 8px;
      padding: 1rem;
      margin-top: 1rem;
    }

    @media (max-width: 768px) {
      .territory-viewer {
        padding: 1rem;
      }
      
      .stats-grid {
        grid-template-columns: 1fr;
      }
      
      .score {
        width: 100px;
        height: 100px;
        font-size: 2rem;
      }
    }
  `]
})
export class TerritoryViewerComponent implements OnInit {
  selectedTerritory: Territory | null = null;
  territories: Territory[] = [];
  zoneData: any = null;
  loading = false;
  error = '';

  constructor(private territoryService: TerritoryService) {}

  ngOnInit() {
    this.loadTerritories();
  }

  loadTerritories() {
    this.territoryService.getAllTerritories().subscribe({
      next: (territories) => {
        this.territories = territories;
      },
      error: (err) => {
        this.error = 'Failed to load territories';
        console.error('Territory loading error:', err);
      }
    });
  }

  onTerritoryChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const territoryId = select.value;
    
    if (territoryId) {
      this.selectedTerritory = this.territories.find(t => t.territoryId === territoryId) || null;
      this.loadZoneData();
    } else {
      this.selectedTerritory = null;
      this.zoneData = null;
    }
  }

  loadZoneData() {
    if (!this.selectedTerritory) return;
    
    this.loading = true;
    this.error = '';
    
    // Load real camera zone data and metrics for the selected territory
    this.territoryService.getCameraZones().subscribe({
      next: (data) => {
        this.zoneData = data;
        
        // Get specific metrics for this territory if available
        if (this.selectedTerritory?.territoryId) {
          this.territoryService.getLocationMetrics(this.selectedTerritory.territoryId).subscribe({
            next: (metrics) => {
              // Enhance zone data with metrics
              this.zoneData.metrics = metrics;
              this.loading = false;
            },
            error: (err) => {
              console.warn('Metrics not available for this zone:', err);
              this.loading = false;
            }
          });
        } else {
          this.loading = false;
        }
      },
      error: (err) => {
        this.error = 'Failed to load real camera zone data';
        this.loading = false;
        console.error('Zone data loading error:', err);
      }
    });
  }

  getScoreClass(score: number): string {
    if (score >= 8) return 'high';
    if (score >= 6) return 'medium';
    return 'low';
  }

  formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }
} 