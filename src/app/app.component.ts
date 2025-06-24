import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavigationComponent } from './components/navigation/navigation.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, CommonModule, NavigationComponent],
  templateUrl: './app.html',
  styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .main-content {
      flex: 1;
    }
  `]
})
export class AppComponent {
  title = 'vibe-check';
  
  constructor(public authService: AuthService) {}
}