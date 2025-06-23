import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations'; // Import animations provider
import { provideHttpClient, withFetch } from '@angular/common/http'; // Import HttpClient provider and withFetch
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app'; // Import Firebase App provider
import { getFirestore, provideFirestore } from '@angular/fire/firestore'; // Import Firestore provider
import { getAuth, provideAuth } from '@angular/fire/auth'; // Import Auth provider
import { getStorage, provideStorage } from '@angular/fire/storage'; // Import Storage provider
// Ensure you have a firebaseConfig object available, likely in an environment file
import { firebaseConfig } from '../environments/environment'; // Assuming firebaseConfig is exported from your environment file

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()), // Provide HttpClient with fetch
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
  ]
};