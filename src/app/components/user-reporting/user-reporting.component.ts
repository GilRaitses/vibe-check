import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-user-reporting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reporting-container">
      <h2>📝 Report Safety Issue</h2>
      
      <form (ngSubmit)="onSubmit()" #reportForm="ngForm">
        <div class="form-section">
          <h3>📍 Location Information</h3>
          <div class="form-row">
            <div class="form-group">
              <label>Latitude:</label>
              <input type="number" [(ngModel)]="report.latitude" name="latitude" 
                     placeholder="40.7128" step="any">
            </div>
        <div class="form-group">
              <label>Longitude:</label>
              <input type="number" [(ngModel)]="report.longitude" name="longitude" 
                     placeholder="-74.0060" step="any">
            </div>
          </div>
          <button type="button" (click)="getCurrentLocation()" class="location-btn">
            📍 Get Current Location
          </button>
        </div>

        <div class="form-section">
          <h3>⚠️ Issue Details</h3>
        <div class="form-group">
            <label>Issue Type:</label>
            <select [(ngModel)]="report.issueType" name="issueType">
              <option value="">Select issue type</option>
              <option value="sidewalk-cycling">Sidewalk Cycling</option>
              <option value="obstruction">Sidewalk Obstruction</option>
              <option value="poor-lighting">Poor Lighting</option>
              <option value="dangerous-crossing">Dangerous Crossing</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Severity Level:</label>
            <div class="severity-options">
              <label class="radio-option">
                <input type="radio" [(ngModel)]="report.severity" name="severity" value="low">
                <span class="severity-low">🟢 Low</span>
              </label>
              <label class="radio-option">
                <input type="radio" [(ngModel)]="report.severity" name="severity" value="medium">
                <span class="severity-medium">🟡 Medium</span>
              </label>
              <label class="radio-option">
                <input type="radio" [(ngModel)]="report.severity" name="severity" value="high">
                <span class="severity-high">🔴 High</span>
              </label>
          </div>
        </div>

        <div class="form-group">
            <label>Description:</label>
            <textarea [(ngModel)]="report.description" name="description" 
                      placeholder="Describe the safety issue..." rows="4"></textarea>
          </div>
        </div>

        <div class="submit-section">
          <button type="submit" [disabled]="isSubmitting" class="submit-btn">
            {{isSubmitting ? '🔄 Submitting...' : '🚀 Submit Report'}}
          </button>
        </div>
      </form>
      
      <div *ngIf="statusMessage" class="status-message" [class]="statusType">
        {{statusMessage}}
      </div>
    </div>
  `,
  styles: [`
    .reporting-container {
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
    }
    
    h2 {
      color: #1976d2;
      text-align: center;
      margin-bottom: 30px;
    }
    
    .form-section {
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .form-section h3 {
      color: #333;
      margin-top: 0;
      margin-bottom: 15px;
      border-bottom: 2px solid #1976d2;
      padding-bottom: 5px;
    }
    
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    
    .form-group {
      margin-bottom: 15px;
    }
    
    .form-group label {
      display: block;
      color: #333;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    }
    
    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #1976d2;
      box-shadow: 0 0 5px rgba(25, 118, 210, 0.3);
    }
    
    .location-btn {
      background: #4caf50;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      margin-top: 10px;
    }
    
    .location-btn:hover {
      background: #45a049;
    }
    
    .severity-options {
      display: flex;
      gap: 15px;
      margin-top: 5px;
    }
    
    .radio-option {
      display: flex;
      align-items: center;
      cursor: pointer;
    }
    
    .radio-option input {
      margin-right: 5px;
      width: auto;
    }
    
    .severity-low { color: #4caf50; }
    .severity-medium { color: #ff9800; }
    .severity-high { color: #f44336; }
    
    .submit-section {
      text-align: center;
    }
    
    .submit-btn {
      background: #1976d2;
      color: white;
      border: none;
      padding: 15px 30px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
    }
    
    .submit-btn:hover:not(:disabled) {
      background: #1565c0;
    }
    
    .submit-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    
    .status-message {
      margin-top: 20px;
      padding: 15px;
      border-radius: 5px;
      text-align: center;
      font-weight: bold;
    }
    
    .status-message.success {
      background: #e8f5e8;
      color: #2e7d32;
      border: 1px solid #4caf50;
    }
    
    .status-message.error {
      background: #ffebee;
      color: #c62828;
      border: 1px solid #f44336;
    }
    
    @media (max-width: 600px) {
      .form-row {
        grid-template-columns: 1fr;
      }
      
      .severity-options {
        flex-direction: column;
        gap: 8px;
      }
    }
  `]
})
export class UserReportingComponent {
  report = {
    latitude: null as number | null,
    longitude: null as number | null,
    issueType: '',
    severity: 'medium',
    description: ''
  };
  
  isSubmitting = false;
  statusMessage = '';
  statusType = '';

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  getCurrentLocation(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.report.latitude = position.coords.latitude;
          this.report.longitude = position.coords.longitude;
          this.showStatus('Location obtained successfully!', 'success');
        },
        (error) => {
          this.showStatus('Unable to get location. Please enter manually.', 'error');
        }
      );
    } else {
      this.showStatus('Geolocation not supported by this browser.', 'error');
    }
  }

  onSubmit(): void {
    if (!this.validateForm()) return;

    this.isSubmitting = true;
    this.statusMessage = '';
    
    // Simulate API submission
    setTimeout(() => {
      const reportData = {
        ...this.report,
        timestamp: new Date().toISOString(),
        reportId: 'RPT-' + Date.now()
      };
      
      console.log('Report submitted:', reportData);
      
      this.showStatus('✅ Report submitted successfully! Thank you for helping improve street safety.', 'success');
      this.resetForm();
      this.isSubmitting = false;
    }, 1500);
  }

  private validateForm(): boolean {
    if (!this.report.latitude || !this.report.longitude) {
      this.showStatus('Please provide location coordinates.', 'error');
      return false;
        }
    
    if (!this.report.issueType) {
      this.showStatus('Please select an issue type.', 'error');
      return false;
    }
    
    return true;
  }

  private showStatus(message: string, type: string): void {
    this.statusMessage = message;
    this.statusType = type;
    
    // Clear message after 5 seconds
    setTimeout(() => {
      this.statusMessage = '';
    }, 5000);
  }

  private resetForm(): void {
    this.report = {
      latitude: null,
      longitude: null,
      issueType: '',
      severity: 'medium',
      description: ''
    };
  }
}