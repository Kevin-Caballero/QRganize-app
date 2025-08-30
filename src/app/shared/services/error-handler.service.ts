import { Injectable } from '@angular/core';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root',
})
export class ErrorHandlerService {
  constructor(private toastService: ToastService) {}

  showErrorToast(error: { status?: number; error?: { message?: string } }) {
    let message = 'An error occurred';

    switch (error.status) {
      case 400:
        message = 'Bad request';
        break;
      case 401:
        message = 'Unauthorized';
        break;
      case 403:
        message = 'Forbidden';
        break;
      case 404:
        message = 'Not found';
        break;
      case 409:
        message = 'Conflict';
        break;
      case 500:
        message = 'Internal server error';
        break;
    }

    this.presentToast(error?.error?.message || message);
  }

  private async presentToast(message: string) {
    await this.toastService.presentErrorToast(message);
  }
}
