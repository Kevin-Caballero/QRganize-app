import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { Keyboard } from '@capacitor/keyboard';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { IonicStorageModule } from '@ionic/storage-angular';
import { DebugInterceptor } from './interceptors/debug.interceptor';
import { ImageModalModule } from './components/image-modal/image-modal.module';
import { BOX_REPOSITORY } from './shared/repositories/box.repository.interface';
import { BoxSqliteRepository } from './shared/repositories/box-sqlite.repository';
import { ITEM_REPOSITORY } from './shared/repositories/item.repository.interface';
import { ItemSqliteRepository } from './shared/repositories/item-sqlite.repository';
import { CHECKLIST_REPOSITORY } from './shared/repositories/checklist.repository.interface';
import { ChecklistSqliteRepository } from './shared/repositories/checklist-sqlite.repository';
import { AUTH_REPOSITORY } from './shared/repositories/auth.repository.interface';
import { FirebaseAuthRepository } from './shared/repositories/firebase-auth.repository';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot({ scrollAssist: false }),
    AppRoutingModule,
    HttpClientModule,
    IonicStorageModule.forRoot(),
    ImageModalModule,
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: DebugInterceptor,
      multi: true,
    },
    // Repository Interface -> SQLite Repository Implementation wiring, per
    // docs/architecture.md's mandatory layering (Spec 002/003/004). Feature
    // Services inject the *_REPOSITORY tokens, never the concrete
    // *SqliteRepository classes directly.
    { provide: BOX_REPOSITORY, useClass: BoxSqliteRepository },
    { provide: ITEM_REPOSITORY, useClass: ItemSqliteRepository },
    { provide: CHECKLIST_REPOSITORY, useClass: ChecklistSqliteRepository },
    // Repository Interface -> Firebase Auth Repository Implementation
    // wiring (Spec 010). AuthGateService injects AUTH_REPOSITORY, never
    // FirebaseAuthRepository directly.
    { provide: AUTH_REPOSITORY, useClass: FirebaseAuthRepository },
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule {
  constructor() {}
}
