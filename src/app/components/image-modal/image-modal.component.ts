import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-image-modal',
  templateUrl: './image-modal.component.html',
  styleUrls: ['./image-modal.component.scss'],
})
export class ImageModalComponent implements OnInit {
  @Input() imageUrl: string = '';

  // Variables para manejar errores
  hasError: boolean = false;
  alternativeUrls: string[] = [];
  currentUrlIndex: number = 0;
  displayUrl: string = '';

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {
    if (this.imageUrl) {
      // Asegurarnos de que estamos usando la URL correcta con /public/images/
      if (
        this.imageUrl.includes(environment.apiUrl) &&
        !this.imageUrl.includes('/public/images/')
      ) {
        const filename = this.extractFilename(this.imageUrl);
        this.displayUrl = `${environment.apiUrl}/public/images/${filename}`;
      } else {
        this.displayUrl = this.imageUrl;
      }
      this.prepareAlternativeUrls();
    }
  }

  prepareAlternativeUrls() {
    // Si la URL ya incluye el dominio completo
    if (this.imageUrl.includes(environment.apiUrl)) {
      const filename = this.extractFilename(this.imageUrl);

      // Asegurarnos de que estamos usando la ruta correcta
      if (!this.imageUrl.includes('/public/images/')) {
        this.alternativeUrls.push(
          `${environment.apiUrl}/public/images/${filename}`
        );
      }
    }
  }

  extractFilename(url: string): string {
    // Extraer solo el nombre del archivo
    const parts = url.split('/');
    return parts[parts.length - 1];
  }

  onClose() {
    this.modalCtrl.dismiss();
  }

  handleImageError() {
    this.hasError = true;

    // Intentar con URL alternativa si existe
    if (this.alternativeUrls.length > this.currentUrlIndex) {
      this.displayUrl = this.alternativeUrls[this.currentUrlIndex];
      this.currentUrlIndex++;
      this.hasError = false;
    }
  }
}
