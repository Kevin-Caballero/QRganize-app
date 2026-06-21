import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { initializeApp } from 'firebase/app';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

// Spec 010: initialize the Firebase JS SDK before any
// @capacitor-firebase/authentication call. Required for the web platform
// (the plugin's web implementation wraps the Firebase JS SDK); a no-op
// concern on native (iOS/Android use the native SDKs, initialized from
// GoogleService-Info.plist/google-services.json instead), but calling it
// unconditionally here is harmless across platforms.
initializeApp(environment.firebaseConfig);

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));
