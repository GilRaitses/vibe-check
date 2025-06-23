import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from './auth.service'; // Adjust the import path if necessary

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.authService.currentUser$.pipe(
      take(1), // Take the first value and complete
      map(user => {
        if (user) {
          return true; // User is logged in, allow access
        } else {
          // User is not logged in, redirect to login page
          return this.router.createUrlTree(['/login']);
        }
      })
    );
  }
}