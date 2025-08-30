// This is a sample environment file.
// Copy this file to environment.ts and adjust the values according to your setup.

export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  socialLoginEnabled: false, // Flag to control social login buttons visibility
  apiUrlAlternatives: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://10.0.2.2:3000', // Special Android emulator address for localhost
    'http://your-local-ip:3000', // Replace with your local network IP
  ],
  firebaseConfig: {
    apiKey: 'your-api-key',
    authDomain: 'your-auth-domain.firebaseapp.com',
    projectId: 'your-project-id',
    storageBucket: 'your-storage-bucket.appspot.com',
    messagingSenderId: 'your-messaging-sender-id',
    appId: 'your-app-id',
  },
};
