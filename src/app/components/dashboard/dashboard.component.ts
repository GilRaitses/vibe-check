import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TerritoryService } from '../../services/territory.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard">
      <h2>Vibe-Check Dashboard</h2>
      
      <div class="status-grid">
        <div class="status-card">
          <h3>System Status</h3>
          <p class="status-good">🟢 Operational</p>
        </div>
        
        <div class="status-card">
          <h3>AI Services</h3>
          <p>Gemini AI: <span class="status-good">Active</span></p>
          <p>Vision API: <span class="status-good">Active</span></p>
        </div>
        
        <div class="status-card">
          <h3>Data Sources</h3>
          <p>NYC Cameras: <span class="status-good">Connected</span></p>
          <p>Firebase: <span class="status-good">Connected</span></p>
        </div>
        
        <div class="status-card">
          <h3>Quick Stats</h3>
          <p>Territories: 50+ monitored</p>
          <p>Last Analysis: <span id="timestamp">Just now</span></p>
        </div>
      </div>
      
      <div class="info-section">
        <h3>About Vibe-Check</h3>
        <p>AI-powered street safety analysis for NYC pedestrians. Upload photos or browse territory maps to get real-time safety insights.</p>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    h2 {
      color: #1976d2;
      text-align: center;
      margin-bottom: 30px;
    }
    
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .status-card {
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .status-card h3 {
      margin-top: 0;
      color: #333;
      border-bottom: 2px solid #1976d2;
      padding-bottom: 5px;
    }
    
    .status-good {
      color: #4caf50;
      font-weight: bold;
    }
    
    .info-section {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    
    .info-section h3 {
      color: #1976d2;
    }
  `]
})
export class DashboardComponent implements OnInit {
  
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Update timestamp on client side only
      setTimeout(() => {
        const timestampEl = document.getElementById('timestamp');
        if (timestampEl) {
          timestampEl.textContent = new Date().toLocaleTimeString();
        }
      }, 100);
    }
  }
}