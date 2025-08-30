import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

interface QrCodeData {
  name: string;
  qrCode: string;
}

@Component({
  selector: 'app-qr-modal',
  templateUrl: './qr-modal.component.html',
  styleUrls: ['./qr-modal.component.scss'],
})
export class QrModalComponent implements OnInit {
  @Input() qrData!: string; // Para un solo código QR
  @Input() multipleQrCodes: QrCodeData[] = []; // Para múltiples códigos QR
  @Input() isMultiple: boolean = false;

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {
    // Si tenemos un solo código QR y no tenemos múltiples, creamos una entrada en multipleQrCodes
    if (!this.isMultiple && this.qrData) {
      this.multipleQrCodes = [
        {
          name: 'QR Code',
          qrCode: this.qrData,
        },
      ];
      this.isMultiple = false;
    }
  }

  closeModal() {
    this.modalCtrl.dismiss();
  }

  printQr() {
    // Añadir un pequeño retraso para asegurar que todos los QR se han renderizado
    setTimeout(() => {
      window.print();
    }, 300);
  }
}
