import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TerritoryService } from '../../services/territory.service';

export interface SystemStatus {
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
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule], // Add HttpClientModule if not provided globally
  template: `
    <div class="dashboard-container">
      <h2>System Dashboard</h2>

      <div *ngIf="loading" class="loading">
        <p>Loading system status...</p>
      </div>

      <div *ngIf="error" class="error">
        <p>Error fetching system status: {{ error }}</p>
      </div>

      <div *ngIf="statusData" class="status-cards">
        <div class="card">
          <h3>Overall Status</h3>
          <p>{{ statusData.status }}</p>
        </div>
        <div class="card">
          <h3>Total Analyses</h3>
          <p>{{ statusData.metrics.totalAnalyses }}</p>
        </div>
        <div class="card">
          <h3>Pending Reports</h3>
          <p>{{ statusData.metrics.pendingReports }}</p>
        </div>
        <div class="card">
          <h3>Success Rate</h3>
          <p>{{ (statusData.metrics.successRate * 100).toFixed(2) }}%</p>
        </div>
        <div class="card">
          <h3>System Health</h3>
          <p>{{ statusData.metrics.systemHealth }}</p>
        </div>
        <div class="card">
          <h3>Gemini AI Status</h3>
          <p>{{ statusData.services.geminiAI }}</p>
        </div>
        <div class="card">
          <h3>Firestore Status</h3>
          <p>{{ statusData.services.firestore }}</p>
        </div>
        <div class="card">
          <h3>Storage Status</h3>
          <p>{{ statusData.services.storage }}</p>
        </div>
         <div class="card">
          <h3>Last Updated</h3>
          <p>{{ statusData.lastUpdated | date:'medium' }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 20px;
      font-family: sans-serif;
      color: #333;
    }
    h2 {
      color: #0056b3;
      margin-bottom: 20px;
    }
    .loading, .error {
      text-align: center;
      font-size: 1.2em;
      margin-top: 20px;
    }
    .error {
      color: #dc3545;
    }
    .status-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }
    .card {
      background-color: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    .card h3 {
      margin-top: 0;
      color: #007bff;
    }
  `]
})
export class DashboardComponent implements OnInit {
  statusData: SystemStatus | null = null;
  loading: boolean = true;
  error: string | null = null;

  constructor(private territoryService: TerritoryService) { }

  ngOnInit(): void {
    this.fetchSystemStatus();
  }

  fetchSystemStatus(): void {
    this.statusData = null; // Clear previous data
    this.loading = true;
    this.error = null;
    this.territoryService.getSystemStatus().subscribe({
      next: (data) => {
        this.statusData = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching system status:', err);
        this.error = 'Could not load system status.';
        this.loading = false;
      }
    });
  }
}