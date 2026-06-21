// This is a sample environment file.
// Copy this file to environment.ts and adjust the values according to your setup.

export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  apiUrlAlternatives: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://10.0.2.2:3000', // Special Android emulator address for localhost
    'http://your-local-ip:3000', // Replace with your local network IP
  ],
  // See environment.ts for Spec 010 Firebase config notes.
  firebaseConfig: {
    apiKey: 'REPLACE_WITH_YOUR_FIREBASE_API_KEY',
    authDomain: 'REPLACE_WITH_YOUR_FIREBASE_AUTH_DOMAIN',
    projectId: 'REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID',
    storageBucket: 'REPLACE_WITH_YOUR_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'REPLACE_WITH_YOUR_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'REPLACE_WITH_YOUR_FIREBASE_APP_ID',
  },
};
