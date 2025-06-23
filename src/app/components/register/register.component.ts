import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="registration-container">
      <h2>Register</h2>
      <form #registrationForm="ngForm" (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label for="email">Email:</label>
          <input type="email" id="email" name="email" [(ngModel)]="email" required>
        </div>
        <div class="form-group">
          <label for="password">Password:</label>
          <input type="password" id="password" name="password" [(ngModel)]="password" required>
        </div>
        <button type="submit" [disabled]="!registrationForm.valid">Register</button>
        <p *ngIf="errorMessage" class="error-message">{{ errorMessage }}</p>
      </form>
    </div>
  `,
  styles: [`
    .registration-container {
      max-width: 400px;
      margin: 50px auto;
      padding: 20px;
      border: 1px solid #ccc;
      border-radius: 8px;
      text-align: center;
    }
    .form-group {
      margin-bottom: 15px;
      text-align: left;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    input[type="email"],
    input[type="password"] {
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    button {
      background-color: #007bff;
      color: white;
      padding: 10px 15px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:disabled {
      background-color: #cccccc;
      cursor: not-allowed;
    }
    .error-message {
      color: red;
      margin-top: 10px;
    }
  `]
})
export class RegistrationComponent {
  email = '';
  password = '';
  errorMessage: string | null = null;

  constructor(private authService: AuthService) { }

  async onSubmit() {
    this.errorMessage = null;
    try {
      // Assuming you add a signUp method to your AuthService
      await this.authService.signUp(this.email, this.password);
      // Redirect or show success message
    } catch (error: any) {
      this.errorMessage = error.message || 'Registration failed';
    }
  }
}