import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-territory-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="map-container">
      <h2>NYC Territory Map</h2>
      
      <div class="map-placeholder">
        <div class="territory-info">
          <h3>🗽 NYC Safety Territories</h3>
          <p>Interactive map will load here with Google Maps integration</p>
          
          <div class="territory-list">
            <div class="territory-item" *ngFor="let territory of territories">
              <div class="territory-header">
                <strong>{{territory.name}}</strong>
                <span class="safety-score" [class]="territory.safetyClass">
                  {{territory.safetyScore}}/10
                </span>
              </div>
              <p>{{territory.description}}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div class="map-controls">
        <button (click)="refreshTerritories()">🔄 Refresh Data</button>
        <button (click)="toggleView()">📍 {{viewMode}} View</button>
      </div>
    </div>
  `,
  styles: [`
    .map-container {
      padding: 20px;
      max-width: 1000px;
      margin: 0 auto;
    }
    
    h2 {
      color: #1976d2;
      text-align: center;
      margin-bottom: 20px;
    }
    
    .map-placeholder {
      height: 400px;
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
      border: 2px dashed #1976d2;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }
    
    .territory-info {
      text-align: center;
      padding: 20px;
    }
    
    .territory-info h3 {
      color: #1976d2;
      margin-bottom: 10px;
    }
    
    .territory-list {
      margin-top: 20px;
      text-align: left;
      max-width: 400px;
    }
    
    .territory-item {
      background: white;
      padding: 10px;
      margin-bottom: 10px;
      border-radius: 5px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .territory-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }
    
    .safety-score {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
    }
    
    .safety-high {
      background: #c8e6c9;
      color: #2e7d32;
    }
    
    .safety-medium {
      background: #fff3e0;
      color: #f57c00;
    }
    
    .safety-low {
      background: #ffcdd2;
      color: #c62828;
    }
    
    .map-controls {
      display: flex;
      gap: 10px;
      justify-content: center;
    }
    
    .map-controls button {
      padding: 10px 20px;
      background: #1976d2;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
    }
    
    .map-controls button:hover {
      background: #1565c0;
    }
  `]
})
export class TerritoryMapComponent implements OnInit {
  viewMode = 'Map';
  
  territories = [
    {
      name: 'Times Square',
      description: 'High pedestrian traffic, moderate cycling violations',
      safetyScore: 6,
      safetyClass: 'safety-medium'
    },
    {
      name: 'Central Park South',
      description: 'Well-maintained sidewalks, good visibility',
      safetyScore: 8,
      safetyClass: 'safety-high'
    },
    {
      name: 'Lower East Side',
      description: 'Narrow sidewalks, frequent cycling issues',
      safetyScore: 4,
      safetyClass: 'safety-low'
    },
    {
      name: 'Financial District',
      description: 'Good infrastructure, business hours congestion',
      safetyScore: 7,
      safetyClass: 'safety-medium'
    }
  ];

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    // Component loads safely without external dependencies
  }
  
  refreshTerritories(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Simulate data refresh
      console.log('Refreshing territory data...');
      
      // Update timestamps or safety scores here if needed
      this.territories = [...this.territories];
    }
  }
  
  toggleView(): void {
    this.viewMode = this.viewMode === 'Map' ? 'List' : 'Map';
  }
}