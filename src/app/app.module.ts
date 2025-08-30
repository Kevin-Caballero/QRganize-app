import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// ===== FIREBASE =====
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { Keyboard } from '@capacitor/keyboard';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { IonicStorageModule } from '@ionic/storage-angular';
import { AuthInterceptor } from './interceptors/auth.interceptor.service';
import { DebugInterceptor } from './interceptors/debug.interceptor';
import { ImageModalModule } from './components/image-modal/image-modal.module';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    // Only add Firebase modules if social login is enabled
    ...(environment.socialLoginEnabled
      ? [
          AngularFireAuthModule,
          AngularFireModule.initializeApp(environment.firebaseConfig),
        ]
      : []),
    IonicModule.forRoot({ scrollAssist: false }),
    AppRoutingModule,
    HttpClientModule,
    IonicStorageModule.forRoot(),
    ImageModalModule,
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // Provide a null value for AngularFireAuth when social login is disabled
    ...(environment.socialLoginEnabled
      ? []
      : [{ provide: 'AngularFireAuth', useValue: null }]),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: DebugInterceptor,
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule {
  constructor() {}
}
