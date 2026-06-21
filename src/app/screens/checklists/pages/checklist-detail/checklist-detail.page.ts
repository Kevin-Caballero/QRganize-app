import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, ModalController, NavController } from '@ionic/angular';
import { LocalChecklistsService } from '../../../../shared/services/local-checklists.service';
import { LocalBoxesService } from '../../../../shared/services/local-boxes.service';
import {
  LocalChecklist,
  LocalChecklistItem,
} from '../../../../shared/models/local-checklist';
import { ChecklistModalComponent } from '../../components/checklist-modal/checklist-modal.component';

/**
 * Checklist detail page. Per docs/specs.md Spec 004, persists through
 * `LocalChecklistsService` only. Box assignment (`LocalChecklist.boxId`,
 * restored per Spec 002's "Addendum 2") is shown as a chip naming the
 * assigned box, resolved via `LocalBoxesService`.
 */
@Component({
  selector: 'app-checklist-detail',
  templateUrl: './checklist-detail.page.html',
  styleUrls: ['./checklist-detail.page.scss'],
})
export class ChecklistDetailPage implements OnInit {
  checklist?: LocalChecklist;
  items: LocalChecklistItem[] = [];
  loading = true;
  checklistId?: string;
  boxName?: string;

  constructor(
    private route: ActivatedRoute,
    private navController: NavController,
    private modalController: ModalController,
    private alertController: AlertController,
    private localChecklistsService: LocalChecklistsService,
    private localBoxesService: LocalBoxesService
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.checklistId = params['id'];
      if (this.checklistId) {
        this.loadData();
      }
    });
  }

  ionViewWillEnter() {
    if (this.checklistId) {
      this.loadData();
    }
  }

  async loadData() {
    if (!this.checklistId) return;

    this.loading = true;
    try {
      const [checklist, items] = await Promise.all([
        this.localChecklistsService.getChecklistById(this.checklistId),
        this.localChecklistsService.getChecklistItems(this.checklistId),
      ]);

      this.checklist = checklist ?? undefined;
      this.items = items;
      this.boxName = undefined;

      if (!checklist) {
        this.navController.back();
      } else if (checklist.boxId) {
        const box = await this.localBoxesService.getBoxById(checklist.boxId);
        this.boxName = box?.name;
      }
    } catch (error) {
      console.error('Error loading checklist:', error);
      this.navController.back();
    } finally {
      this.loading = false;
    }
  }

  async openEditModal() {
    if (!this.checklist) return;

    const modal = await this.modalController.create({
      component: ChecklistModalComponent,
      componentProps: {
        checklist: this.checklist,
      },
    });

    modal.onDidDismiss().then((result) => {
      if (result.data) {
        this.loadData();
      }
    });

    return await modal.present();
  }

  async deleteChecklist() {
    if (!this.checklist) return;

    const alert = await this.alertController.create({
      header: 'Delete Checklist',
      message: `Are you sure you want to delete "${this.checklist.title}"?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.localChecklistsService.deleteChecklist(
                this.checklist!.id
              );
              this.navController.back();
            } catch (error) {
              console.error('Error deleting checklist:', error);
              this.showErrorAlert('Failed to delete checklist');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  onChecklistUpdated() {
    this.loadData();
  }

  getCompletedItemsCount(): number {
    return this.items.filter((item) => item.isCompleted).length;
  }

  getCompletionPercentage(): number {
    if (this.items.length === 0) return 0;
    return Math.round((this.getCompletedItemsCount() / this.items.length) * 100);
  }

  private async showErrorAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  goBack() {
    this.navController.back();
  }
}
