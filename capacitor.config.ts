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
  },
  android: {
    backgroundColor: '#ffffff',
    iconPath: 'resources/android/icon/drawable-xxxhdpi-icon.png',
    splashPath: 'resources/android/splash/drawable-port-xxxhdpi-screen.png'
  },
};

export default config;
