/// <reference types="@capacitor-firebase/authentication" />

import { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.qrganize.kvn',
  appName: "QRganize",
  webDir: 'www',
  server: {
    androidScheme: 'http',
    cleartext: true, // Allow cleartext traffic for development
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      showSpinner: true,
      spinnerColor: "#3880ff"
    },
    Keyboard: {
      resize: KeyboardResize.None,
    },
    // Spec 010: mandatory Firebase Authentication gate.
    // `providers: ["google.com"]` loads the Google sign-in provider on the
    // native layer (Android/iOS); email/password needs no provider entry.
    // `skipNativeAuth: false` (the default) is kept so native Google
    // sign-in goes through the native Firebase/Google SDKs, not a web-only
    // OAuth popup, per Spec 010's acceptance criteria.
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
  android: {
    backgroundColor: '#ffffff',
    iconPath: 'resources/android/icon/drawable-xxxhdpi-icon.png',
    splashPath: 'resources/android/splash/drawable-port-xxxhdpi-screen.png'
  },
};

export default config;
