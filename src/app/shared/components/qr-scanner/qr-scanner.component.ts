import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  ModalController,
  AlertController,
  LoadingController,
} from '@ionic/angular';
import { BarcodeScannerService } from 'src/app/shared/services/barcode-scanner.service';
import { BoxService } from 'src/app/screens/home/services/box.service';
import { Router } from '@angular/router';
import { ToastService } from 'src/app/shared/services/toast.service';

@Component({
  selector: 'app-qr-scanner',
  templateUrl: './qr-scanner.component.html',
  styleUrls: ['./qr-scanner.component.scss'],
})
export class QrScannerComponent implements OnInit, OnDestroy {
  isScanning = false;
  scanError = '';

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private barcodeScannerService: BarcodeScannerService,
    private boxService: BoxService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.startScanning();
  }

  ngOnDestroy() {
    this.stopScanning();
  }

  async startScanning() {
    if (!this.barcodeScannerService.isSupported()) {
      await this.showAlert(
        'Scanner not supported',
        'QR Scanner is not supported on this device.'
      );
      return;
    }

    try {
      this.isScanning = true;
      this.scanError = '';

      const scannedData = await this.barcodeScannerService.startScan();

      if (scannedData) {
        await this.handleScannedData(scannedData);
      }
    } catch (error: any) {
      console.error('Scan error:', error);
      this.scanError = error.message || 'Error occurred while scanning';

      if (error.message?.includes('permission')) {
        await this.handlePermissionDenied();
      }
    } finally {
      this.isScanning = false;
    }
  }

  async stopScanning() {
    if (this.isScanning) {
      await this.barcodeScannerService.stopScan();
      this.isScanning = false;
    }
  }

  async handleScannedData(data: string) {
    const loading = await this.loadingController.create({
      message: 'Processing QR code...',
    });
    await loading.present();

    try {
      // Extract box ID from QR data (assuming format: http://localhost:3000/box/{id})
      const boxId = this.extractBoxIdFromQrData(data);

      if (boxId) {
        // Navigate to box detail page
        await this.dismissModal();
        await this.router.navigate(['/tabs/home/box', boxId]);
        await this.toastService.presentSuccessToast(
          'QR Code scanned successfully!'
        );
      } else {
        await this.showAlert(
          'Invalid QR Code',
          'This QR code is not recognized as a valid box code.'
        );
      }
    } catch (error) {
      console.error('Error processing QR data:', error);
      await this.showAlert('Error', 'Failed to process the QR code data.');
    } finally {
      await loading.dismiss();
    }
  }

  private extractBoxIdFromQrData(data: string): string | null {
    try {
      // Handle different QR data formats
      if (data.includes('/box/')) {
        const parts = data.split('/box/');
        if (parts.length > 1) {
          const id = parts[1].split('/')[0]; // Get ID before any trailing slash
          return id;
        }
      }

      // If it's just a number, assume it's a box ID
      if (/^\d+$/.test(data)) {
        return data;
      }

      return null;
    } catch (error) {
      console.error('Error extracting box ID:', error);
      return null;
    }
  }

  async handlePermissionDenied() {
    const alert = await this.alertController.create({
      header: 'Camera Permission Required',
      message:
        'Camera permission is required to scan QR codes. Please grant permission in settings.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Open Settings',
          handler: () => {
            this.barcodeScannerService.openAppSettings();
          },
        },
      ],
    });
    await alert.present();
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  async dismissModal() {
    await this.modalController.dismiss();
  }

  async retryScanning() {
    this.scanError = '';
    await this.startScanning();
  }
}
