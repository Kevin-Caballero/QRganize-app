import { Injectable } from '@angular/core';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { Platform } from '@ionic/angular';

@Injectable({
  providedIn: 'root',
})
export class BarcodeScannerService {
  constructor(private platform: Platform) {}

  async checkPermissions(): Promise<boolean> {
    try {
      const status = await BarcodeScanner.checkPermission({ force: false });
      return status.granted || false;
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }

  async startScan(): Promise<string | null> {
    try {
      // Check if we have permission
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        // Intenta solicitar el permiso nuevamente
        const status = await BarcodeScanner.checkPermission({ force: true });
        if (!status.granted) {
          throw new Error('No camera permission granted');
        }
      }

      // Make sure the interface is prepared for scanning
      document.body.style.opacity = '0';
      document.body.style.background = 'transparent';

      // Prepare the scanner
      await BarcodeScanner.hideBackground();
      document.querySelector('body')?.classList.add('scanner-active');

      // Start scanning (sin opciones para evitar problemas de tipo)
      const result = await BarcodeScanner.startScan();

      // Check if we have a result
      if (result.hasContent) {
        await this.stopScan();
        return result.content;
      }

      await this.stopScan();
      return null;
    } catch (error) {
      console.error('Error during scanning:', error);
      await this.stopScan();
      throw error;
    }
  }

  async stopScan(): Promise<void> {
    try {
      // Restore original visibility
      document.body.style.opacity = '1';
      document.body.style.background = '';

      await BarcodeScanner.showBackground();
      await BarcodeScanner.stopScan();
      document.querySelector('body')?.classList.remove('scanner-active');
    } catch (error) {
      console.error('Error stopping scan:', error);
    }
  }

  async openAppSettings(): Promise<void> {
    await BarcodeScanner.openAppSettings();
  }

  isSupported(): boolean {
    return this.platform.is('capacitor');
  }
}
