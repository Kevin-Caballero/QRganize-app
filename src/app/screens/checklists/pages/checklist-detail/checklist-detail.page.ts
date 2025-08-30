import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  NavController,
  ModalController,
  AlertController,
} from '@ionic/angular';
import { ChecklistService } from '../../../../shared/services/checklist.service';
import { BoxService } from '../../../home/services/box.service';
import { Checklist } from '../../../../shared/interfaces/checklist.interface';
import { Box } from '../../../home/models/box.interface';
import { ChecklistModalComponent } from '../../components/checklist-modal/checklist-modal.component';

@Component({
  selector: 'app-checklist-detail',
  templateUrl: './checklist-detail.page.html',
  styleUrls: ['./checklist-detail.page.scss'],
})
export class ChecklistDetailPage implements OnInit {
  checklist?: Checklist;
  boxes: Box[] = [];
  loading = true;
  checklistId?: number;

  constructor(
    private route: ActivatedRoute,
    private navController: NavController,
    private modalController: ModalController,
    private alertController: AlertController,
    private checklistService: ChecklistService,
    private boxService: BoxService
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.checklistId = +params['id'];
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
    this.loading = true;
    try {
      const [checklist, boxes] = await Promise.all([
        this.checklistService.getChecklist(this.checklistId!).toPromise(),
        this.boxService.getBoxes().toPromise(),
      ]);

      this.checklist = checklist;
      this.boxes = (boxes[0] as Box[]) || [];
    } catch (error) {
      console.error('Error loading checklist:', error);
      // Navigate back if checklist not found
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
        boxes: this.boxes,
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
      message: `Are you sure you want to delete "${this.checklist.name}"?`,
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
              await this.checklistService
                .deleteChecklist(this.checklist!.id!)
                .toPromise();
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

  async assignToBox() {
    if (!this.checklist) return;

    try {
      // Hacer petición al backend para obtener cajas disponibles
      const availableBoxes = await this.boxService
        .getAvailableForChecklist()
        .toPromise();

      if (!availableBoxes || availableBoxes.length === 0) {
        const alert = await this.alertController.create({
          header: 'No Available Boxes',
          message: 'All boxes already have checklists assigned.',
          buttons: ['OK'],
        });
        await alert.present();
        return;
      }

      const inputs = availableBoxes.map((box) => ({
        name: 'box',
        type: 'radio' as const,
        label: box.name,
        value: box.id,
        checked: this.checklist?.boxId === box.id,
      }));

      const alert = await this.alertController.create({
        header: 'Assign to Box',
        inputs,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Assign',
            handler: async (boxId) => {
              if (boxId && this.checklist) {
                try {
                  await this.checklistService
                    .assignToBox(this.checklist.id!, boxId)
                    .toPromise();
                  this.loadData();
                } catch (error) {
                  console.error('Error assigning checklist:', error);
                  this.showErrorAlert('Failed to assign checklist');
                }
              }
            },
          },
        ],
      });

      await alert.present();
    } catch (error) {
      console.error('Error loading available boxes:', error);
      this.showErrorAlert('Could not load available boxes. Please try again.');
    }
  }

  async unassignFromBox() {
    if (!this.checklist) return;

    try {
      await this.checklistService
        .unassignFromBox(this.checklist.id!)
        .toPromise();
      this.loadData();
    } catch (error) {
      console.error('Error unassigning checklist:', error);
      this.showErrorAlert('Failed to unassign checklist');
    }
  }

  onChecklistUpdated() {
    this.loadData();
  }

  getBoxName(): string {
    if (!this.checklist?.boxId) return '';
    const box = this.boxes.find((b) => b.id === this.checklist?.boxId);
    return box ? box.name : 'Unknown Box';
  }

  getCompletedItemsCount(): number {
    if (!this.checklist?.items) return 0;
    return this.checklist.items.filter((item) => item.isCompleted).length;
  }

  getCompletionPercentage(): number {
    if (!this.checklist?.items || this.checklist.items.length === 0) return 0;
    const completed = this.getCompletedItemsCount();
    return Math.round((completed / this.checklist.items.length) * 100);
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
