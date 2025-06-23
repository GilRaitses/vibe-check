import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

const firebaseConfig = {
  projectId: 'vibe-check-463816',
  authDomain: 'vibe-check-463816.firebaseapp.com',
  storageBucket: 'vibe-check-463816.appspot.com',
  messagingSenderId: '123456789', // Replace with actual
  appId: '1:123456789:web:abcdef', // Replace with actual
  // For development, we'll use these basic settings
};

// Google Maps will be loaded by the GoogleMapsModule

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideClientHydration(withEventReplay()),
    // Temporarily disable Firebase auth for frontend demo
    // provideFirebaseApp(() => initializeApp(firebaseConfig)),
    // provideAuth(() => getAuth()),
    // provideFirestore(() => getFirestore())
  ]
};
