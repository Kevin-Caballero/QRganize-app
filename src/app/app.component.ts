import { Component } from '@angular/core';
import { NavController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { register } from 'swiper/element/bundle';
import { AppStartupRouteService } from './shared/services/app-startup-route.service';
import { SqliteService } from './core/sqlite/sqlite.service';
import { AppearanceService } from './shared/services/appearance.service';
import { ExpirationNotificationsService } from './shared/services/expiration-notifications.service';

register();

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  /**
   * Drives the splash/loading template while the SQLite database
   * initializes (and migrations run) at startup, per Spec 002's UI/UX
   * requirement ("App must not show a blank screen while the database
   * initializes"). Starts `true` and is only set to `false` once startup
   * routing has been resolved and navigated to (success or failure).
   */
  starting = true;

  /**
   * Set when SQLite initialization throws. The splash stays visible (with
   * an error message instead of a spinner) rather than silently navigating
   * into a startup route that may depend on a database that failed to open.
   */
  dbInitFailed = false;

  constructor(
    private navCtrl: NavController,
    private appStartupRouteService: AppStartupRouteService,
    private sqliteService: SqliteService,
    private appearanceService: AppearanceService,
    private expirationNotificationsService: ExpirationNotificationsService,
    private storage: Storage
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

    // `@ionic/storage-angular`'s `Storage` throws "Database not created.
    // Must call create() first" from any `get()`/`set()` call made before
    // this resolves. Must run before `AppearanceService` (and later
    // `AppStartupRouteService`) touch `Storage`. Safe to call more than
    // once (Settings page also calls it before reading driver info).
    await this.storage.create();

    // Apply the persisted theme and font size (Spec 016) before the first
    // route renders. This has no data-access dependency (Storage + DOM
    // only), so it is safe to run before SQLite initialization and fixes
    // the previous cold-start gap where appearance only applied once the
    // user visited Settings.
    await this.appearanceService.loadAndApplyPersistedAppearance();

    try {
      // Opens/creates the local SQLite database and runs pending migrations
      // (see SqliteService.initialize()/MigrationRunner) before any local
      // repository can be used. Must complete before startup route
      // navigation, per docs/architecture.md's mandatory layering — no
      // page/component initializes SQLite itself.
      await this.sqliteService.initialize();
    } catch (error) {
      // Per Spec 002's UI/UX requirement ("Database initialization errors
      // must be visible or logged clearly"): log loudly and let the app
      // continue to startup routing rather than leaving a blank screen
      // forever. Local-data screens that depend on SQLite will surface
      // their own errors when they try to read/write.
      console.error(
        'DEBUG - APP INFO - SQLite initialization failed:',
        error
      );
      this.dbInitFailed = true;
      this.starting = false;
      return;
    }

    // Spec 017's startup reconciliation: cancel-all-then-reschedule-from-
    // current-items, so any drift (system time changes, a previous session
    // crashing mid-mutation) self-heals on next launch. Only runs when
    // reminders are enabled and permission is already granted -- this must
    // not request permission itself; only the Settings toggle does that.
    // Deliberately non-fatal: a failure here should not block startup
    // routing.
    try {
      const expirationReminders =
        (await this.storage.get('expirationReminders')) !== false;
      if (expirationReminders) {
        const hasPermission =
          await this.expirationNotificationsService.hasPermission();
        if (hasPermission) {
          const reminderDays =
            Number((await this.storage.get('reminderDays')) || '3') || 3;
          await this.expirationNotificationsService.rescheduleAll(
            reminderDays
          );
        }
      }
    } catch (error) {
      console.error(
        'DEBUG - APP INFO - Expiration notification reconciliation failed:',
        error
      );
    }

    const startupRoute = await this.appStartupRouteService.resolveStartupRoute();
    this.navCtrl.navigateRoot(startupRoute);
    this.starting = false;
  }
}
