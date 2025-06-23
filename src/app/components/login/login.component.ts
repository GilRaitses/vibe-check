import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <h2>Login</h2>
      <form (submit)="onSubmit()">
        <div>
          <label for="email">Email:</label>
          <input type="email" id="email" [(ngModel)]="email" name="email" required>
        </div>
        <div>
          <label for="password">Password:</label>
          <input type="password" id="password" [(ngModel)]="password" name="password" required>
        </div>
        <button type="submit">Login</button>
      </form>
    </div>
  `,
  styles: []
})
export class LoginComponent {
  email = '';
  password = '';

  constructor(private authService: AuthService) {}

  async onSubmit() {
    try {
      await this.authService.signIn(this.email, this.password);
      console.log('Login successful');
      // Redirect or navigate after successful login
    } catch (error) {
      console.error('Login failed:', error);
      // Display error message to user
    }
  }
}