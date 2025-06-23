import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-analysis-interface',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="analysis-container">
      <h2>🔍 Street Scene Analysis</h2>
      
      <div class="upload-section">
        <div class="upload-area" [class.active]="isDragOver" 
             (dragover)="onDragOver($event)" 
             (dragleave)="onDragLeave($event)" 
             (drop)="onDrop($event)">
          <div class="upload-content">
            <div class="upload-icon">📸</div>
            <h3>Upload Street Photo</h3>
            <p>Drag & drop or click to select</p>
            <input type="file" #fileInput (change)="onFileSelected($event)" 
                   accept="image/*" style="display: none;">
            <button (click)="fileInput.click()">Choose File</button>
          </div>
        </div>
        
        <div *ngIf="selectedFileName" class="file-info">
          <p>📄 Selected: {{selectedFileName}}</p>
          <button (click)="analyzeImage()" [disabled]="isAnalyzing">
            {{isAnalyzing ? '🔄 Analyzing...' : '🚀 Analyze Image'}}
          </button>
        </div>
      </div>
      
      <div *ngIf="analysisResult" class="results-section">
        <h3>🎯 Analysis Results</h3>
        <div class="result-card">
          <div class="score-display">
            <div class="score-circle" [class]="getScoreClass()">
              {{analysisResult.safetyScore}}/10
            </div>
            <div class="score-info">
              <h4>Safety Score</h4>
              <p class="risk-level">Risk Level: {{analysisResult.riskLevel}}</p>
            </div>
          </div>
          
          <div class="analysis-details">
            <div class="detail-section">
              <h5>🚨 Detected Hazards</h5>
              <ul>
                <li *ngFor="let hazard of analysisResult.hazards">{{hazard}}</li>
              </ul>
            </div>
            
            <div class="detail-section">
              <h5>💡 Recommendations</h5>
              <ul>
                <li *ngFor="let rec of analysisResult.recommendations">{{rec}}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <div *ngIf="errorMessage" class="error-section">
        <p>❌ {{errorMessage}}</p>
      </div>
    </div>
  `,
  styles: [`
    .analysis-container {
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    
    h2 {
      color: #1976d2;
      text-align: center;
      margin-bottom: 30px;
    }
    
    .upload-section {
      margin-bottom: 30px;
    }
    
    .upload-area {
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      transition: all 0.3s ease;
      cursor: pointer;
    }
    
    .upload-area.active,
    .upload-area:hover {
      border-color: #1976d2;
      background-color: #f0f8ff;
    }
    
    .upload-icon {
      font-size: 48px;
      margin-bottom: 10px;
    }
    
    .upload-content h3 {
      color: #333;
      margin-bottom: 5px;
    }
    
    .upload-content p {
      color: #666;
      margin-bottom: 15px;
    }
    
    .upload-content button {
      background: #1976d2;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
    }
    
    .upload-content button:hover {
      background: #1565c0;
    }
    
    .file-info {
      margin-top: 15px;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 5px;
      text-align: center;
    }
    
    .file-info button {
      background: #4caf50;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      margin-top: 10px;
    }
    
    .file-info button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    
    .results-section {
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      margin-top: 20px;
    }
    
    .results-section h3 {
      color: #1976d2;
      margin-bottom: 20px;
    }
    
    .score-display {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .score-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: bold;
      color: white;
      margin-right: 20px;
    }
    
    .score-high { background: #4caf50; }
    .score-medium { background: #ff9800; }
    .score-low { background: #f44336; }
    
    .risk-level {
      font-weight: bold;
      text-transform: capitalize;
    }
    
    .analysis-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    
    .detail-section h5 {
      color: #333;
      margin-bottom: 10px;
    }
    
    .detail-section ul {
      list-style: none;
      padding: 0;
    }
    
    .detail-section li {
      background: #f9f9f9;
      padding: 8px 12px;
      margin-bottom: 5px;
      border-left: 3px solid #1976d2;
      border-radius: 3px;
    }
    
    .error-section {
      background: #ffebee;
      color: #c62828;
      padding: 15px;
      border-radius: 5px;
      text-align: center;
      margin-top: 20px;
    }
    
    @media (max-width: 600px) {
      .analysis-details {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AnalysisInterfaceComponent {
  selectedFileName: string | null = null;
  isAnalyzing = false;
  isDragOver = false;
  analysisResult: any = null;
  errorMessage: string | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.handleFile(file);
    }
  }

  private handleFile(file: File): void {
    if (file.type.startsWith('image/')) {
      this.selectedFileName = file.name;
      this.errorMessage = null;
    } else {
      this.errorMessage = 'Please select an image file';
      this.selectedFileName = null;
    }
  }

  analyzeImage(): void {
    if (!this.selectedFileName) return;
    
    this.isAnalyzing = true;
    this.errorMessage = null;
    
    // Simulate analysis with mock data
    setTimeout(() => {
      this.analysisResult = {
        safetyScore: Math.floor(Math.random() * 10) + 1,
        riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        hazards: [
          'Bicycle on sidewalk detected',
          'Poor visibility due to obstruction',
          'Narrow pedestrian space'
        ],
        recommendations: [
          'Use alternate route during peak hours',
          'Stay alert for cycling activity',
          'Consider well-lit areas after dark'
        ]
      };
      this.isAnalyzing = false;
    }, 2000);
  }

  getScoreClass(): string {
    if (!this.analysisResult) return 'score-medium';
    
    const score = this.analysisResult.safetyScore;
    if (score >= 7) return 'score-high';
    if (score >= 4) return 'score-medium';
    return 'score-low';
  }
}