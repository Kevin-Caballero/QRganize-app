import { Component } from '@angular/core';
import { NavController } from '@ionic/angular';
import { register } from 'swiper/element/bundle';
import { AuthService } from './shared/services/auth.service';
import { Storage } from '@ionic/storage-angular';
import { AuthInterceptor } from './interceptors/auth.interceptor.service';

register();

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(
    private navCtrl: NavController,
    private authService: AuthService,
    private storage: Storage,
    private interceptor: AuthInterceptor
  ) {
    this.initializeApp();
  }

  async initializeApp() {
    // Añadir información de depuración para la configuración
    import('src/environments/environment').then((env) => {
      console.log('DEBUG - APP INFO - Environment loaded:', {
        production: env.environment.production,
        apiUrl: env.environment.apiUrl,
      });

      // Asignar a window para acceso global (depuración)
      (window as any).isProduction = env.environment.production;
      (window as any).apiUrl = env.environment.apiUrl;

      console.log(
        'DEBUG - APP INFO - App initialized with API URL:',
        env.environment.apiUrl
      );
      console.log(
        'DEBUG - APP INFO - Running in production mode:',
        env.environment.production
      );
    });

    const onboardingComplete = await this.storage.get('onboardingComplete');
    if (onboardingComplete) {
      const isLoggedIn = await this.authService.isLoggedIn();
      if (isLoggedIn) {
        this.navCtrl.navigateRoot('/tabs/home');
      } else {
        this.navCtrl.navigateRoot('/login');
      }
    } else {
      this.navCtrl.navigateRoot('/onboarding');
    }
  }
}
