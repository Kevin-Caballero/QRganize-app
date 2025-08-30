import { Injectable } from '@angular/core';
import { ToastController, ToastOptions } from '@ionic/angular';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  constructor(private toastController: ToastController) {}

  private async presentToast(
    message: string,
    color: string,
    icon: string,
    duration?: number
  ) {
    const options: ToastOptions = {
      message,
      color,
      position: 'top',
      icon,
      swipeGesture: 'vertical',
      buttons: [
        {
          text: 'Close',
          role: 'cancel',
        },
      ],
    };

    if (duration) {
      options.duration = duration;
    }

    const toast = await this.toastController.create(options);
    toast.present();
  }

  async presentSuccessToast(message: string) {
    await this.presentToast(
      message,
      'success',
      'checkmark-circle-outline',
      3000
    );
  }

  async presentErrorToast(message: string) {
    await this.presentToast(message, 'danger', 'close-circle-outline');
  }

  async presentWarningToast(message: string) {
    await this.presentToast(message, 'warning', 'alert-circle-outline');
  }

  async presentInfoToast(message: string) {
    await this.presentToast(
      message,
      'primary',
      'information-circle-outline',
      5000
    );
  }
}
