import { Injectable } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, authState, User } from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user$: Observable<User | null> = authState(this.auth);

  constructor(private auth: Auth) { }

  async signIn(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error; // Re-throw the error for the component to handle
    }
  }

  async signUp(email: string, password: string): Promise<void> {
    try {
      await createUserWithEmailAndPassword(this.auth, email, password);
    } catch (error) {
      console.error('Sign up failed:', error);
      throw error; // Re-throw the error for the component to handle
    }
  }

  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
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