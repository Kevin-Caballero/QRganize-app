import { Component, OnInit, Renderer2 } from '@angular/core';
import {
  AlertController,
  LoadingController,
  ToastController,
} from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BoxService } from '../home/services/box.service';
import { ItemService } from '../home/services/item.service';
import { LocalChecklistsService } from 'src/app/shared/services/local-checklists.service';
import { AuthGateService } from 'src/app/shared/services/auth-gate.service';
import { AuthUser } from 'src/app/shared/models/auth-user';
import {
  AppearanceService,
  AppTheme,
} from 'src/app/shared/services/appearance.service';
import { ExpirationNotificationsService } from 'src/app/shared/services/expiration-notifications.service';
import { forkJoin, from, of } from 'rxjs';
import { catchError, finalize, switchMap, map } from 'rxjs/operators';

type User = AuthUser;

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {
  // User properties
  user: User | null = null;

  // Summary stats
  boxesCount: number = 0;
  checklistsCount: number = 0;
  itemsCount: number = 0;
  isLoadingStats: boolean = false;

  // Appearance properties
  theme: AppTheme = 'system';

  // Notification properties
  expirationReminders: boolean = true;
  reminderDays: string = '3';

  // App information
  appVersion: string = '1.0.0';

  constructor(
    private storage: Storage,
    private renderer: Renderer2,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private http: HttpClient,
    private router: Router,
    private boxService: BoxService,
    private itemService: ItemService,
    private localChecklistsService: LocalChecklistsService,
    private authGateService: AuthGateService,
    private appearanceService: AppearanceService,
    private expirationNotificationsService: ExpirationNotificationsService
  ) {}

  async ngOnInit() {
    // Initialize storage
    await this.storage.create();

    // Load saved settings
    this.loadSettings();

    // Check authentication status
    this.checkAuthStatus();
  }

  ionViewWillEnter() {
    // Load user stats when entering the page
    // This will refresh stats each time the page is visited
    this.loadUserStats();
  }

  async loadSettings() {
    // Load saved preferences (display state for the ion-selects only --
    // the actual appearance was already applied at app startup via
    // AppearanceService.loadAndApplyPersistedAppearance(), see
    // app.component.ts).
    this.theme = ((await this.storage.get('theme')) || 'system') as AppTheme;
    this.expirationReminders =
      (await this.storage.get('expirationReminders')) !== false;
    this.reminderDays = (await this.storage.get('reminderDays')) || '3';

    // Spec 017's "permission-state honesty" requirement: if the stored
    // value says reminders are on but the OS permission has since been
    // revoked (e.g. the user turned it off in Android app settings), the
    // toggle must not keep lying about being "on" with nothing actually
    // scheduled. Flip the in-memory + persisted value to match reality.
    if (this.expirationReminders) {
      const hasPermission =
        await this.expirationNotificationsService.hasPermission();
      if (!hasPermission) {
        this.expirationReminders = false;
        await this.storage.set('expirationReminders', false);
      }
    }
  }

  async loadUserStats() {
    this.isLoadingStats = true;

    try {
      // Create observables for each statistic
      const boxes$ = this.boxService.getBoxes().pipe(
        catchError((error) => {
          console.error('Error fetching boxes:', error);
          return of([[], 0]);
        })
      );

      const checklists$ = from(
        this.localChecklistsService.getAllChecklists()
      ).pipe(
        catchError((error) => {
          console.error('Error fetching checklists:', error);
          return of([]);
        })
      );

      // Get all items from all boxes
      const items$ = this.getAllItems().pipe(
        catchError((error) => {
          console.error('Error fetching items:', error);
          return of([]);
        })
      );

      // Use forkJoin to run all requests in parallel
      forkJoin({
        boxes: boxes$,
        checklists: checklists$,
        items: items$,
      })
        .pipe(
          finalize(() => {
            this.isLoadingStats = false;
          })
        )
        .subscribe({
          next: (results) => {
            // Process results
            this.boxesCount = Array.isArray(results.boxes[0])
              ? Number(results.boxes[1])
              : 0;
            this.checklistsCount = Array.isArray(results.checklists)
              ? results.checklists.length
              : 0;
            this.itemsCount = Array.isArray(results.items)
              ? results.items.length
              : 0;
          },
          error: (error) => {
            console.error('Error loading user stats:', error);
            this.showToast('Failed to load statistics');
            this.isLoadingStats = false;
          },
        });
    } catch (error) {
      console.error('Error in loadUserStats:', error);
      this.isLoadingStats = false;
    }
  }

  // Helper method to get all items across all boxes
  private getAllItems() {
    return this.boxService.getBoxes({ page: 1, size: 1000 }).pipe(
      catchError((error) => {
        console.error('Error fetching boxes for items:', error);
        return of([[], 0]);
      }),
      switchMap((boxesResult: any) => {
        const boxes = boxesResult[0];
        if (!Array.isArray(boxes) || boxes.length === 0) {
          return of([]);
        }

        // Get items for each box
        const itemRequests = boxes.map((box: any) =>
          this.itemService.getItemsByBox(box.id).pipe(
            catchError((error) => {
              console.error(`Error fetching items for box ${box.id}:`, error);
              return of([]);
            })
          )
        );

        // Combine all item requests
        return forkJoin(itemRequests).pipe(
          map((itemArrays: any[]) => {
            // Flatten array of arrays into a single array of all items
            return itemArrays.reduce(
              (allItems, boxItems) => [...allItems, ...boxItems],
              []
            );
          })
        );
      })
    );
  }

  async checkAuthStatus() {
    // Per Spec 010, the current user comes from the Firebase Authentication
    // gate (AuthGateService) rather than legacy `storage.get('user')`.
    this.user = await this.authGateService.getCurrentUser();
  }

  changeTheme() {
    this.appearanceService.applyTheme(this.theme);
    this.storage.set('theme', this.theme);
  }

  /**
   * Handler for the "Expiration Reminders" toggle (Spec 017). Kept separate
   * from `onReminderDaysChange()` (the "days before" select's handler)
   * because turning the toggle on/off has a different side effect
   * (request permission / cancel all) than changing the offset
   * (reschedule all with the new offset) -- collapsing them into one
   * shared method would make the permission-request path harder to follow.
   */
  async onExpirationRemindersChange() {
    if (this.expirationReminders) {
      const granted = await this.expirationNotificationsService.requestPermission();
      if (!granted) {
        // Reflect the real denied state rather than showing "on" while
        // scheduling nothing (Spec 017's UI/UX requirement).
        this.expirationReminders = false;
        await this.storage.set('expirationReminders', false);
        await this.showToast(
          'Reminders are off until notifications are allowed in your device settings.'
        );
        return;
      }

      await this.storage.set('expirationReminders', true);
      await this.expirationNotificationsService.rescheduleAll(
        Number(this.reminderDays) || 3
      );
      return;
    }

    await this.storage.set('expirationReminders', false);
    await this.expirationNotificationsService.cancelAll();
  }

  /**
   * Handler for the "Reminder Time" (`reminderDays`) select (Spec 017). See
   * `onExpirationRemindersChange()`'s doc comment for why this is a
   * separate method.
   */
  async onReminderDaysChange() {
    await this.storage.set('reminderDays', this.reminderDays);

    if (this.expirationReminders) {
      await this.expirationNotificationsService.rescheduleAll(
        Number(this.reminderDays) || 3
      );
    }
  }

  async login() {
    this.router.navigate(['/login']);
  }

  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Log Out',
      message: 'Are you sure you want to log out?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Log Out',
          role: 'confirm',
          handler: async () => {
            // Sign-out goes through AuthGateService -> AuthRepository ->
            // FirebaseAuthRepository (Spec 010), never the Firebase plugin
            // directly.
            await this.authGateService.signOut();
            this.user = null;
            this.showToast('Successfully logged out');
            this.router.navigate(['/login']);
          },
        },
      ],
      cssClass: 'alert-logout',
    });

    await alert.present();
  }

  async showHelp() {
    // Navigate to help page or show a modal with information
    const alert = await this.alertCtrl.create({
      header: 'Help & Support',
      message:
        'QRganize helps you organize your belongings using QR codes. For any questions or issues, please contact our support team at support@qrganize.com',
      buttons: ['OK'],
    });

    await alert.present();
  }

  private async showToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'bottom',
    });

    await toast.present();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
