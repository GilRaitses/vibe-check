import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="navbar">
      <div class="navbar-brand">Vibe-Check</div>
      <div class="navbar-links">
        <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
        <a routerLink="/analysis" routerLinkActive="active">Analysis</a>
        <a routerLink="/reporting" routerLinkActive="active">Reporting</a>
        <a routerLink="/territories" routerLinkActive="active">Territories</a>
        <a routerLink="/map" routerLinkActive="active">Map</a>
      </div>
      <div class="navbar-status">
        <span>System Status: Operational</span>
        <span>User: Guest</span>
      </div>
    </nav>
  `,
  styles: `
    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #1976d2; /* NYC Blue */
      padding: 10px 20px;
      color: white;
      font-family: sans-serif;
    }
    .navbar-brand {
      font-size: 20px;
      font-weight: bold;
    }
    .navbar-links a {
      color: white;
      text-decoration: none;
      margin: 0 15px;
      font-size: 16px;
      padding: 5px 0;
      border-bottom: 2px solid transparent;
      transition: border-bottom 0.3s ease-in-out;
    }
    .navbar-links a:hover {
      border-bottom-color: white;
    }
    .navbar-links a.active {
      border-bottom-color: white;
      font-weight: bold;
    }
    .navbar-status {
      font-size: 14px;
    }
    .navbar-status span {
      margin-left: 15px;
    }
  `
})
export class NavigationComponent { }