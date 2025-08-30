import { Component, OnInit, Renderer2 } from '@angular/core';
import {
  AlertController,
  LoadingController,
  ToastController,
} from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { environment } from 'src/environments/environment';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BoxService } from '../home/services/box.service';
import { ItemService } from '../home/services/item.service';
import { ChecklistService } from 'src/app/shared/services/checklist.service';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, switchMap, map } from 'rxjs/operators';

interface User {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  uid: string;
}

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
  darkMode: boolean = false;
  fontSize: string = 'medium';

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
    private checklistService: ChecklistService
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
    // Load saved preferences
    this.darkMode = (await this.storage.get('darkMode')) || false;
    this.fontSize = (await this.storage.get('fontSize')) || 'medium';
    this.expirationReminders =
      (await this.storage.get('expirationReminders')) !== false;
    this.reminderDays = (await this.storage.get('reminderDays')) || '3';

    // Apply dark mode if active
    this.applyDarkMode(this.darkMode);

    // Apply font size
    this.applyFontSize(this.fontSize);
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

      const checklists$ = this.checklistService.getChecklists().pipe(
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
    // Obtener información del usuario desde storage
    const userData = await this.storage.get('user');
    if (userData) {
      this.user = JSON.parse(userData);
    }
  }

  toggleDarkMode() {
    this.applyDarkMode(this.darkMode);
    this.storage.set('darkMode', this.darkMode);
  }

  applyDarkMode(isDark: boolean) {
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }

  changeFontSize() {
    this.applyFontSize(this.fontSize);
    this.storage.set('fontSize', this.fontSize);
  }

  applyFontSize(size: string) {
    // Eliminar clases previas de tamaño
    document.body.classList.remove('font-small', 'font-medium', 'font-large');
    // Aplicar nueva clase de tamaño
    document.body.classList.add(`font-${size}`);
  }

  updateNotificationSettings() {
    this.storage.set('expirationReminders', this.expirationReminders);
    this.storage.set('reminderDays', this.reminderDays);
  }

  async login() {
    // Authentication logic would be implemented here
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
            // Logout logic
            this.user = null;
            await this.storage.remove('user');
            await this.storage.remove('authToken');
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
