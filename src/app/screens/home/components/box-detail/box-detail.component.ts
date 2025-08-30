import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BoxStateService } from '../../services/box-state.service';
import { Box } from '../../models/box.interface';
import { ModalController, ScrollDetail, AlertController } from '@ionic/angular';
import { IonContentCustomEvent } from '@ionic/core';
import { ImageModalComponent } from 'src/app/components/image-modal/image-modal.component';
import { ItemModalComponent } from '../item-modal/item-modal.component';
import { ItemService } from '../../services/item.service';
import { CreateItemDto, Item } from '../../models/item.interface';
import { ToastService } from 'src/app/shared/services/toast.service';
import { ChecklistService } from 'src/app/shared/services/checklist.service';
import { Checklist } from 'src/app/shared/interfaces/checklist.interface';
import { BoxModalComponent } from '../box-modal/box-modal.component';
import { BoxReqDto } from '../../models/box-req.dto';
import { Subject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ImageUrlService } from 'src/app/shared/services/image-url.service';

@Component({
  selector: 'app-box-detail',
  templateUrl: './box-detail.component.html',
  styleUrls: ['./box-detail.component.scss'],
})
export class BoxDetailComponent implements OnInit {
  private id: string = this.route.snapshot.paramMap.get('id') || '';
  box: Box;
  items: Item[] = [];
  isLoadingItems = false;
  assignedChecklist: Checklist | null = null;
  isLoadingChecklist = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private boxStateService: BoxStateService,
    private modalController: ModalController,
    private itemService: ItemService,
    private alertController: AlertController,
    private toastService: ToastService,
    private checklistService: ChecklistService,
    private imageUrlService: ImageUrlService
  ) {}

  ngOnInit() {
    this.loadBoxData();
  }

  ionViewWillEnter() {
    this.loadBoxData();
  }

  private loadBoxData() {
    this.boxStateService.getBoxById(this.id).subscribe((box) => {
      this.box = box;
      if (this.box) {
        this.loadItems();
        this.loadAssignedChecklist();
      }
    });
  }

  loadAssignedChecklist() {
    if (!this.box?.id) return;

    this.isLoadingChecklist = true;
    this.checklistService.getChecklistByBoxId(this.box.id).subscribe({
      next: (checklist) => {
        this.assignedChecklist = checklist;
        this.isLoadingChecklist = false;
      },
      error: () => {
        this.isLoadingChecklist = false;
      },
    });
  }

  loadItems() {
    if (!this.box) return;

    this.isLoadingItems = true;
    this.itemService.getItemsByBox(this.box.id).subscribe({
      next: (items) => {
        this.items = items;
        this.isLoadingItems = false;
      },
      error: () => {
        this.isLoadingItems = false;
        this.toastService.presentErrorToast('Error loading items');
      },
    });
  }

  logScrolling($event: IonContentCustomEvent<ScrollDetail>) {
    // throw new Error('Method not implemented.');
  }

  async onImageClick(imageUrl: string) {
    const modal = await this.modalController.create({
      component: ImageModalComponent,
      componentProps: {
        imageUrl,
      },
    });
    modal.present();
  }

  async onAddItem() {
    const modal = await this.modalController.create({
      component: ItemModalComponent,
      componentProps: {
        boxId: this.box.id,
      },
    });

    modal.onDidDismiss().then((result) => {
      if (result.role === 'confirm' && result.data) {
        this.createItem(result.data);
      }
    });

    modal.present();
  }

  async createItem(itemData: CreateItemDto) {
    this.itemService.createItem(this.box.id, itemData).subscribe({
      next: (newItem) => {
        this.items.unshift(newItem);
        this.toastService.presentSuccessToast(
          `Item "${newItem.name}" added successfully`
        );
      },
      error: () => {
        this.toastService.presentErrorToast('Error creating item');
      },
    });
  }

  async onEditItem(item: Item) {
    const modal = await this.modalController.create({
      component: ItemModalComponent,
      componentProps: {
        boxId: this.box.id,
        item: item,
      },
    });

    modal.onDidDismiss().then((result) => {
      if (result.role === 'confirm' && result.data) {
        this.updateItem(item.id, result.data);
      }
    });

    modal.present();
  }

  async updateItem(itemId: number, itemData: Partial<CreateItemDto>) {
    this.itemService.updateItem(itemId, itemData).subscribe({
      next: (updatedItem) => {
        const index = this.items.findIndex((item) => item.id === itemId);
        if (index !== -1) {
          this.items[index] = updatedItem;
        }
        this.toastService.presentSuccessToast(
          `Item "${updatedItem.name}" updated successfully`
        );
      },
      error: () => {
        this.toastService.presentErrorToast('Error updating item');
      },
    });
  }

  async onDeleteItem(item: Item) {
    const alert = await this.alertController.create({
      header: 'Delete Item',
      message: `Are you sure you want to delete "${item.name}"?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.deleteItem(item.id);
          },
        },
      ],
    });

    await alert.present();
  }

  deleteItem(itemId: number) {
    this.itemService.deleteItem(itemId).subscribe({
      next: () => {
        this.items = this.items.filter((item) => item.id !== itemId);
        this.toastService.presentSuccessToast('Item deleted successfully');
      },
      error: () => {
        this.toastService.presentErrorToast('Error deleting item');
      },
    });
  }

  viewChecklist() {
    if (this.assignedChecklist) {
      this.router.navigate(['/tabs/checklist', this.assignedChecklist.id]);
    }
  }

  async onEditBox() {
    if (!this.box) return;

    const boxSubject = new Subject<BoxReqDto>();

    const modal = await this.modalController.create({
      component: BoxModalComponent,
      componentProps: {
        boxSubject,
        box: this.box,
      },
    });

    // Suscribirse al subject para recibir los datos del modal
    const subscription = boxSubject.subscribe((boxData) => {
      this.boxStateService.updateBox(this.box.id, boxData);
      subscription.unsubscribe();
    });

    // Cuando se cierra el modal, limpiar suscripción
    modal.onDidDismiss().then(() => {
      if (!subscription.closed) {
        subscription.unsubscribe();
      }
      // Recargar datos del box
      this.loadBoxData();
    });

    await modal.present();
  }

  /**
   * Obtiene la URL de la imagen del item, considerando diferentes posibles propiedades
   */
  getItemImageUrl(item: Item): string | null {
    // Verificamos si tenemos una URL directa que podemos usar
    if (
      item.imageUrl &&
      typeof item.imageUrl === 'string' &&
      item.imageUrl.trim() !== ''
    ) {
      // Usar el servicio para obtener la URL absoluta
      return this.imageUrlService.getAbsoluteUrl(item.imageUrl);
    }

    // Verificamos otras propiedades posibles
    const anyItem = item as any;

    // Si el item tiene un qrcode, usarlo como imagen
    if (
      anyItem.qrcode &&
      typeof anyItem.qrcode === 'string' &&
      anyItem.qrcode.trim() !== ''
    ) {
      return anyItem.qrcode;
    }

    // Verificar si hay un box con qrcode
    if (
      anyItem.box &&
      anyItem.box.qrcode &&
      typeof anyItem.box.qrcode === 'string' &&
      anyItem.box.qrcode.trim() !== ''
    ) {
      return anyItem.box.qrcode;
    }

    // Verificar otras posibles propiedades de imagen
    if (
      anyItem.image &&
      typeof anyItem.image === 'string' &&
      anyItem.image.trim() !== ''
    ) {
      return anyItem.image;
    }

    return null;
  }
}
