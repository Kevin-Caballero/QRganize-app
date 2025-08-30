import { Component, OnInit } from '@angular/core';
import {
  ModalController,
  AlertController,
  NavController,
  ToastController,
} from '@ionic/angular';
import { ToastService } from '../../shared/services/toast.service';
import { ChecklistService } from '../../shared/services/checklist.service';
import { BoxService } from '../home/services/box.service';
import { Checklist } from '../../shared/interfaces/checklist.interface';
import { Box } from '../home/models/box.interface';
import { ChecklistModalComponent } from './components/checklist-modal/checklist-modal.component';

@Component({
  selector: 'app-checklists',
  templateUrl: './checklists.page.html',
  styleUrls: ['./checklists.page.scss'],
})
export class ChecklistsPage implements OnInit {
  checklists: Checklist[] = [];
  boxes: Box[] = [];
  loading = true;

  constructor(
    private checklistService: ChecklistService,
    private boxService: BoxService,
    private modalController: ModalController,
    private alertController: AlertController,
    private toastController: ToastController,
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
      const [checklists, boxes] = await Promise.all([
        this.checklistService.getChecklists().toPromise(),
        this.boxService.getBoxes().toPromise(),
      ]);

      this.checklists = checklists || [];
      this.boxes = (boxes[0] as Box[]) || [];
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      this.loading = false;
    }
  }

  async openCreateModal() {
    // Pasar todas las cajas disponibles, ya que asignar una caja es opcional
    const modal = await this.modalController.create({
      component: ChecklistModalComponent,
      componentProps: {
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

  async openEditModal(checklist: Checklist) {
    const modal = await this.modalController.create({
      component: ChecklistModalComponent,
      componentProps: {
        checklist,
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

  async deleteChecklist(checklist: Checklist) {
    const alert = await this.alertController.create({
      header: 'Delete Checklist',
      message: `Delete "${checklist.name}"? This cannot be undone.`,
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
              await this.checklistService
                .deleteChecklist(checklist.id)
                .toPromise();
              this.loadData();

              // Usar el servicio de toast para mostrar un mensaje de éxito
              await this.toastService.presentSuccessToast(
                `"${checklist.name}" has been deleted.`
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

  async assignToBox(checklist: Checklist) {
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
        checked: checklist.boxId === box.id,
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
              if (boxId) {
                try {
                  await this.checklistService
                    .assignToBox(checklist.id, boxId)
                    .toPromise();
                  this.loadData();
                } catch (error) {
                  console.error('Error assigning checklist:', error);
                }
              }
            },
          },
        ],
      });

      await alert.present();
    } catch (error) {
      console.error('Error loading available boxes:', error);
      const alert = await this.alertController.create({
        header: 'Error',
        message: 'Could not load available boxes. Please try again.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  async unassignFromBox(checklist: Checklist) {
    const alert = await this.alertController.create({
      header: 'Unassign Checklist',
      message: `Unassign "${checklist.name}" from its box?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'alert-button-cancel',
        },
        {
          text: 'Unassign',
          cssClass: 'alert-button-confirm',
          handler: async () => {
            try {
              await this.checklistService
                .unassignFromBox(checklist.id)
                .toPromise();
              this.loadData();

              // Usar el servicio de toast para mostrar un mensaje de éxito
              await this.toastService.presentSuccessToast(
                `"${checklist.name}" has been unassigned.`
              );
            } catch (error) {
              console.error('Error unassigning checklist:', error);

              const errorAlert = await this.alertController.create({
                header: 'Error',
                message: 'Failed to unassign checklist. Please try again.',
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

  getCompletionPercentage(checklist: Checklist): number {
    if (!checklist.items || checklist.items.length === 0) return 0;
    const completed = checklist.items.filter((item) => item.isCompleted).length;
    return Math.round((completed / checklist.items.length) * 100);
  }

  getCompletedItemsCount(checklist: Checklist): number {
    if (!checklist.items) return 0;
    return checklist.items.filter((item) => item.isCompleted).length;
  }

  getBoxName(boxId: number): string {
    const box = this.boxes.find((b) => b.id === boxId);
    return box ? box.name : 'Unknown Box';
  }

  openChecklistDetail(checklist: Checklist) {
    this.navController.navigateForward(`/tabs/checklist/${checklist.id}`);
  }
}
