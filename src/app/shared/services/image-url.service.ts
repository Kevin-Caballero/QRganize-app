import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ImageUrlService {
  constructor() {}

  /**
   * Obtiene la URL absoluta para una imagen del servidor
   * @param imagePath Ruta de la imagen (puede ser nombre de archivo o ruta relativa)
   * @returns URL absoluta al recurso
   */
  getAbsoluteUrl(imagePath: string): string {
    if (!imagePath) return '';

    // Si ya es una URL absoluta, devolverla tal cual
    if (imagePath.startsWith('http')) {
      return imagePath;
    }

    // Extraer el nombre del archivo si es una ruta
    const filename = imagePath.includes('/')
      ? imagePath.split('/').pop() || imagePath
      : imagePath;

    return `${environment.apiUrl}/public/images/${filename}`;
  }

  /**
   * Obtiene la URL base del API según el entorno
   */
  getApiBaseUrl(): string {
    return environment.apiUrl;
  }
}
