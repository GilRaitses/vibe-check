import { Injectable } from '@angular/core';
// import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, authState, User } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';

interface User {
  uid: string;
  email: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user$: Observable<User | null>;

  constructor() { 
    // Temporary: Return mock user observable for demo
    this.user$ = of(null);
  }

  async signIn(email: string, password: string): Promise<void> {
    try {
      // Temporarily disabled for demo - would normally sign in with Firebase Auth
      console.log('Demo mode: Sign in requested for', email);
      // await signInWithEmailAndPassword(this.auth, email, password);
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error; // Re-throw the error for the component to handle
    }
  }

  async signUp(email: string, password: string): Promise<void> {
    try {
      // Temporarily disabled for demo - would normally create user with Firebase Auth
      console.log('Demo mode: Sign up requested for', email);
      // await createUserWithEmailAndPassword(this.auth, email, password);
    } catch (error) {
      console.error('Sign up failed:', error);
      throw error; // Re-throw the error for the component to handle
    }
  }

  async signOut(): Promise<void> {
    try {
      // Temporarily disabled for demo - would normally sign out with Firebase Auth
      console.log('Demo mode: Sign out requested');
      // await signOut(this.auth);
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error; // Re-throw the error for the component to handle
    }
  }

  // This observable emits the current user or null whenever the auth state changes.
  // Components can subscribe to this to react to login/logout events.
  getAuthState(): Observable<User | null> {
    return this.user$;
  }
}