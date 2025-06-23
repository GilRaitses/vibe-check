import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { inject } from '@angular/core';
import { AuthService } from './services/auth.service';
import { map } from 'rxjs/operators';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./components/register/register.component').then(m => m.RegistrationComponent) },
  { path: '', canActivate: [() => inject(AuthService).user$.pipe(map(user => user ? true : false))], children: [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: 'dashboard', loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent) },
    { path: 'analysis', loadComponent: () => import('./components/analysis-interface/analysis-interface.component').then(m => m.AnalysisInterfaceComponent) },
    { path: 'reporting', loadComponent: () => import('./components/user-reporting/user-reporting.component').then(m => m.UserReportingComponent) },
    { path: 'map', loadComponent: () => import('./components/territory-map/territory-map.component').then(m => m.TerritoryMapComponent) },
    { path: 'territories', loadComponent: () => import('./components/territory-viewer/territory-viewer.component').then(m => m.TerritoryViewerComponent) }, // Keeping existing territory viewer
    // TODO: Add status and admin components when needed
  ],
 },
 { path: '**', redirectTo: 'login' } // Redirect any unknown routes to login
];
