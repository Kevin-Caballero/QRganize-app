import { Component, OnInit } from '@angular/core';
import { AlertController, ModalController, NavController } from '@ionic/angular';
import { ToastService } from '../../shared/services/toast.service';
import { LocalChecklistsService } from '../../shared/services/local-checklists.service';
import { LocalBoxesService } from '../../shared/services/local-boxes.service';
import { LocalChecklist } from '../../shared/models/local-checklist';
import { ChecklistModalComponent } from './components/checklist-modal/checklist-modal.component';

/**
 * Checklists list page. Per docs/specs.md Spec 004, persistence goes through
 * `LocalChecklistsService` (Feature Service) -> `ChecklistRepository` ->
 * SQLite, never directly. Box assignment (`LocalChecklist.boxId`, restored
 * per Spec 002's "Addendum 2") is shown as a chip naming the assigned box,
 * resolved via `LocalBoxesService`.
 */
@Component({
  selector: 'app-checklists',
  templateUrl: './checklists.page.html',
  styleUrls: ['./checklists.page.scss'],
})
export class ChecklistsPage implements OnInit {
  checklists: LocalChecklist[] = [];
  itemCounts: Record<string, { total: number; completed: number }> = {};
  boxNames: Record<string, string> = {};
  loading = true;

  constructor(
    private localChecklistsService: LocalChecklistsService,
    private localBoxesService: LocalBoxesService,
    private modalController: ModalController,
    private alertController: AlertController,
    private toastService: ToastService,
    private navController: NavController
  ) {}

  ngOnInit() {
    this.loadData();
  }

  ionViewWillEnter() {
    this.loadData();
  }

  async loadData() {
    this.loading = true;
    try {
      const checklists = await this.localChecklistsService.getAllChecklists();
      this.checklists = checklists;
      this.itemCounts = {};
      this.boxNames = {};

      const boxes = await this.localBoxesService.getAllBoxes();
      const boxNameById = new Map(boxes.map((box) => [box.id, box.name]));

      for (const checklist of checklists) {
        const items = await this.localChecklistsService.getChecklistItems(
          checklist.id
        );
        this.itemCounts[checklist.id] = {
          total: items.length,
          completed: items.filter((item) => item.isCompleted).length,
        };

        if (checklist.boxId) {
          const boxName = boxNameById.get(checklist.boxId);
          if (boxName) {
            this.boxNames[checklist.id] = boxName;
          }
        }
      }
    } catch (error) {
      console.error('Error loading checklists:', error);
    } finally {
      this.loading = false;
    }
  }

  async openCreateModal() {
    const modal = await this.modalController.create({
      component: ChecklistModalComponent,
    });

    modal.onDidDismiss().then((result) => {
      if (result.data) {
        this.loadData();
      }
    });

    return await modal.present();
  }

  async openEditModal(checklist: LocalChecklist) {
    const modal = await this.modalController.create({
      component: ChecklistModalComponent,
      componentProps: {
        checklist,
      },
    });

    modal.onDidDismiss().then((result) => {
      if (result.data) {
        this.loadData();
      }
    });

    return await modal.present();
  }

  async deleteChecklist(checklist: LocalChecklist) {
    const alert = await this.alertController.create({
      header: 'Delete Checklist',
      message: `Delete "${checklist.title}"? This cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'alert-button-cancel',
        },
        {
          text: 'Delete',
          cssClass: 'alert-button-confirm',
          handler: async () => {
            try {
              await this.localChecklistsService.deleteChecklist(checklist.id);
              this.loadData();

              await this.toastService.presentSuccessToast(
                `"${checklist.title}" has been deleted.`
              );
            } catch (error) {
              console.error('Error deleting checklist:', error);

              const errorAlert = await this.alertController.create({
                header: 'Error',
                message: 'Failed to delete checklist. Please try again.',
                buttons: [
                  {
                    text: 'OK',
                    cssClass: 'alert-button-retry',
                  },
                ],
                cssClass: 'error-alert',
              });
              await errorAlert.present();
            }
          },
        },
      ],
      cssClass: 'custom-alert',
    });

    await alert.present();
  }

  getCompletionPercentage(checklist: LocalChecklist): number {
    const counts = this.itemCounts[checklist.id];
    if (!counts || counts.total === 0) return 0;
    return Math.round((counts.completed / counts.total) * 100);
  }

  getCompletedItemsCount(checklist: LocalChecklist): number {
    return this.itemCounts[checklist.id]?.completed ?? 0;
  }

  getTotalItemsCount(checklist: LocalChecklist): number {
    return this.itemCounts[checklist.id]?.total ?? 0;
  }

  getBoxName(checklist: LocalChecklist): string | undefined {
    return this.boxNames[checklist.id];
  }

  openChecklistDetail(checklist: LocalChecklist) {
    this.navController.navigateForward(`/tabs/checklist/${checklist.id}`);
  }
}
