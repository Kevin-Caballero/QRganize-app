import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  constructor(private modalController: ModalController) {}

  async openQrScanner() {
    // We'll dynamically import the component to avoid circular dependencies
    const { QrScannerComponent } = await import(
      '../components/qr-scanner/qr-scanner.component'
    );

    const modal = await this.modalController.create({
      component: QrScannerComponent,
    });

    await modal.present();
    return modal;
  }
}
