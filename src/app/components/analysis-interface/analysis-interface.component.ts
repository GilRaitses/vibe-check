import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TerritoryService, Analysis } from '../../services/territory.service';

@Component({
  selector: 'app-analysis-interface',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div>
      <h2>Street Scene Analysis</h2>
      <input type="file" (change)="onFileSelected($event)" accept="image/*">

      <div *ngIf="isLoading">
        <p>Analyzing image...</p>
      </div>

      <div *ngIf="analysisResult">
        <h3>Analysis Results:</h3>
        <p><strong>Safety Score:</strong> {{ analysisResult.safetyScore }}</p>
        <p><strong>Risk Level:</strong> {{ analysisResult.riskLevel }}</p>
        <p><strong>Hazards:</strong> {{ analysisResult.hazards.join(', ') }}</p>
        <p><strong>Recommendations:</strong> {{ analysisResult.recommendations.join(', ') }}</p>
        <h4>Infrastructure Observations:</h4>
        <ul>
          <li><strong>Bike Activity:</strong> {{ analysisResult.infrastructure.bikeActivity }}</li>
          <li><strong>Pedestrian Space:</strong> {{ analysisResult.infrastructure.pedestrianSpace }}</li>
          <li><strong>Visibility:</strong> {{ analysisResult.infrastructure.visibility }}</li>
        </ul>
        <p><strong>Confidence:</strong> {{ analysisResult.confidence }}</p>
      </div>

      <div *ngIf="error">
        <p style="color: red;">Error: {{ error }}</p>
      </div>
    </div>
  `,
  styles: []
})
export class AnalysisInterfaceComponent {
  selectedFile: File | null = null;
  analysisResult: Analysis | null = null;
  isLoading = false;
  error: string | null = null;

  constructor(private territoryService: TerritoryService) { }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.analyzeImage();
    }
  }

  analyzeImage(): void {
    if (!this.selectedFile) {
      this.error = 'No file selected.';
      return;
    }

    this.isLoading = true;
    this.analysisResult = null;
    this.error = null;

    const reader = new FileReader();
    reader.onload = (event: any) => {
      const imageData = event.target.result.split(',')[1]; // Get base64 data

      // Example metadata - replace with actual location data
      const metadata = {
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          territory: 'example-territory-id'
        },
        timestamp: Date.now(),
        source: 'frontend-upload'
      };

      this.territoryService.analyzeImage(imageData, metadata).subscribe({
        next: (response) => {
          this.analysisResult = response.analysis;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Analysis API Error:', err);
          this.error = 'Failed to analyze image. Please try again.';
          this.isLoading = false;
        }
      });
    };
    reader.readAsDataURL(this.selectedFile);
  }
}