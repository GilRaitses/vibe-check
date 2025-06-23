import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { TerritoryService } from '../services/territory.service'; // Adjust the path as necessary

@Component({
  selector: 'app-user-reporting',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HttpClientModule
  ],
  template: `
    <div class="reporting-container">
      <h2>Submit Violation Report</h2>
      <form [formGroup]="reportForm" (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label for="reportType">Report Type:</label>
          <select id="reportType" formControlName="reportType" required>
            <option value="">-- Select Report Type --</option>
            <option value="Sidewalk Cycling">Sidewalk Cycling</option>
            <option value="Blocking">Blocking</option>
            <option value="Infrastructure Hazard">Infrastructure Hazard</option>
            <option value="Other">Other</option>
          </select>
          <div *ngIf="reportForm.get('reportType')?.invalid && reportForm.get('reportType')?.touched" class="error-message">
            Report type is required.
          </div>
        </div>

        <div class="form-group">
          <label for="latitude">Latitude:</label>
          <input type="number" id="latitude" formControlName="latitude" required step="any">
          <div *ngIf="reportForm.get('latitude')?.invalid && reportForm.get('latitude')?.touched" class="error-message">
            Latitude is required.
          </div>
        </div>

        <div class="form-group">
          <label for="longitude">Longitude:</label>
          <input type="number" id="longitude" formControlName="longitude" required step="any">
          <div *ngIf="reportForm.get('longitude')?.invalid && reportForm.get('longitude')?.touched" class="error-message">
            Longitude is required.
          </div>
        </div>

        <div class="form-group">
          <label for="description">Description:</label>
          <textarea id="description" formControlName="description" rows="4"></textarea>
        </div>

        <div class="form-group">
          <label for="severity">Severity:</label>
          <select id="severity" formControlName="severity">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div class="form-group">
          <label for="image">Upload Image (Optional):</label>
          <input type="file" id="image" (change)="onFileSelected($event)" accept="image/*">
        </div>

        <button type="submit" [disabled]="reportForm.invalid || isLoading">
          Submit Report
          <span *ngIf="isLoading" class="spinner"></span>
        </button>

        <div *ngIf="successMessage" class="success-message">{{ successMessage }}</div>
        <div *ngIf="errorMessage" class="error-message">{{ errorMessage }}</div>
      </form>
    </div>
  `,
  styles: [`
    .reporting-container {
      max-width: 600px;
      margin: 20px auto;
      padding: 20px;
      background-color: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    h2 {
      color: #1976d2; /* NYC Blue */
      text-align: center;
      margin-bottom: 20px;
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
      color: #424242; /* NYC Gray */
    }
    input[type="text"], input[type="number"], textarea, select {
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-sizing: border-box;
    }
    button {
      background-color: #4caf50; /* NYC Green */
      color: white;
      padding: 10px 15px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
    }
    button:disabled {
      background-color: #cccccc;
      cursor: not-allowed;
    }
    .spinner {
      border: 2px solid #f3f3f3;
      border-top: 2px solid #3498db;
      border-radius: 50%;
      width: 12px;
      height: 12px;
      animation: spin 1s linear infinite;
      margin-left: 10px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .success-message {
      margin-top: 15px;
      padding: 10px;
      background-color: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
      border-radius: 4px;
      text-align: center;
    }
    .error-message {
      margin-top: 15px;
      padding: 10px;
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
      text-align: center;
    }
  `
})
export class UserReportingComponent {
  reportForm: FormGroup;
  selectedFile: File | null = null;
  isLoading = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private territoryService: TerritoryService // Corrected service injection
  ) {
    this.reportForm = this.fb.group({
      reportType: ['', Validators.required],
      latitude: ['', Validators.required],
      longitude: ['', Validators.required],
      description: [''],
      severity: ['medium']
    });
  }

  onFileSelected(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.selectedFile = files[0];
    } else {
      this.selectedFile = null;
    }
  }

  onSubmit(): void {
    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.successMessage = null;
    this.errorMessage = null;

    const formData = this.reportForm.value;
    let imageDataUrl: string | undefined = undefined;

    const sendReport = (dataUrl?: string) => {
      const reportPayload = {
        location: {
          lat: formData.latitude,
          lng: formData.longitude
          // territory will be determined on the backend
        },
        reportType: formData.reportType,
        description: formData.description,
        severity: formData.severity,
        imageData: dataUrl?.split(',')[1] // Send base64 data without the prefix
      };

      this.territoryService.submitReport(reportPayload).subscribe({
        next: (response) => {
          this.successMessage = 'Report submitted successfully!';
          this.reportForm.reset({ severity: 'medium' });
          this.selectedFile = null;
          const fileInput = document.getElementById('image') as HTMLInputElement;
          if (fileInput) {
            fileInput.value = '';
          }
          console.log('Report submission success:', response);
        },
        error: (error) => {
          this.errorMessage = 'Failed to submit report. Please try again.';
          console.error('Report submission error:', error);
        },
        complete: () => {
          this.isLoading = false;
        }
      });
    };

    if (this.selectedFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        imageDataUrl = reader.result as string;
        sendReport(imageDataUrl);
      };
      reader.onerror = (error) => {
        this.errorMessage = 'Failed to read image file.';
        this.isLoading = false;
        console.error('File reading error:', error);
      };
      reader.readAsDataURL(this.selectedFile);
    } else {
      sendReport();
    }
  }
}