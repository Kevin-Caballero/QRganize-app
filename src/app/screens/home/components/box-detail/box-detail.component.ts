import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BoxStateService } from '../../services/box-state.service';
import { Box } from '../../models/box.interface';
import {
  ModalController,
  ScrollDetail,
  AlertController,
  ActionSheetController,
} from '@ionic/angular';
import { IonContentCustomEvent } from '@ionic/core';
import { ImageModalComponent } from 'src/app/components/image-modal/image-modal.component';
import { ItemModalComponent } from '../item-modal/item-modal.component';
import { ItemService } from '../../services/item.service';
import { CreateItemDto, Item } from '../../models/item.interface';
import { ToastService } from 'src/app/shared/services/toast.service';
import { LocalChecklistsService } from 'src/app/shared/services/local-checklists.service';
import { LocalChecklist } from 'src/app/shared/models/local-checklist';
import { BoxModalComponent } from '../box-modal/box-modal.component';
import { BoxReqDto } from '../../models/box-req.dto';
import { Subject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ImageUrlService } from 'src/app/shared/services/image-url.service';
import { BoxService } from '../../services/box.service';
import { QrModalComponent } from '../qr-modal/qr-modal.component';

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
  assignedChecklist: LocalChecklist | null = null;
  isLoadingChecklist = false;

  // Resolved image sources (Spec 012): resolution is async (web must read
  // the file back out of Capacitor's IndexedDB-backed Filesystem storage
  // and re-encode it as a fresh data: URL on every render), so these are
  // populated via resolveImageSrc() rather than bound directly in the
  // template against the raw stored value.
  resolvedBoxImageUrl: string | null = null;
  itemImageUrls: { [itemId: string]: string | null } = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private boxStateService: BoxStateService,
    private modalController: ModalController,
    private itemService: ItemService,
    private alertController: AlertController,
    private toastService: ToastService,
    private localChecklistsService: LocalChecklistsService,
    private imageUrlService: ImageUrlService,
    private boxService: BoxService,
    private actionSheetController: ActionSheetController
  ) {}

  isLoadingAvailableChecklists = false;

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
        this.resolveBoxImage();
      }
    });
  }

  private resolveBoxImage() {
    this.imageUrlService
      .resolveImageSrc(this.box?.imageUrl)
      .then((resolved) => {
        this.resolvedBoxImageUrl = resolved;
      });
  }

  loadAssignedChecklist() {
    if (!this.box) {
      this.assignedChecklist = null;
      this.isLoadingChecklist = false;
      return;
    }

    this.isLoadingChecklist = true;
    // `LocalChecklist.boxId` and `box.id` are both string UUIDs now, so this
    // lookup works correctly (see docs/specs.md Spec 007 addendum).
    this.localChecklistsService
      .getAllChecklists()
      .then((checklists) => {
        this.assignedChecklist =
          checklists.find((cl) => cl.boxId === this.box.id) || null;
        this.isLoadingChecklist = false;
      })
      .catch(() => {
        this.assignedChecklist = null;
        this.isLoadingChecklist = false;
      });
  }

  loadItems() {
    if (!this.box) return;

    this.isLoadingItems = true;
    this.itemService.getItemsByBox(this.box.id).subscribe({
      next: (items) => {
        this.items = items;
        this.isLoadingItems = false;
        this.resolveItemImages(items);
      },
      error: () => {
        this.isLoadingItems = false;
        this.toastService.presentErrorToast('Error loading items');
      },
    });
  }

  private resolveItemImages(items: Item[]) {
    this.itemImageUrls = {};
    items.forEach((item) => {
      this.imageUrlService.resolveImageSrc(item.imageUrl).then((resolved) => {
        this.itemImageUrls[item.id] = resolved;
      });
    });
  }

  /**
   * Resolved (render-time) image source for an item, or null for "no
   * image" (including dead blob: rows — see ImageUrlService.resolveImageSrc).
   */
  getResolvedItemImageUrl(item: Item): string | null {
    return this.itemImageUrls[item.id] ?? null;
  }

  logScrolling($event: IonContentCustomEvent<ScrollDetail>) {
    // throw new Error('Method not implemented.');
  }

  async onImageClick(imageUrl: string | null) {
    if (!imageUrl) {
      return;
    }
    const modal = await this.modalController.create({
      component: ImageModalComponent,
      componentProps: {
        imageUrl,
      },
    });
    modal.present();
  }

  async onAddItem() {
    // A sealed box represents a physically closed box with its QR already
    // attached -- adding items behind its back would desync the item list
    // from reality. Block and require an explicit "Reopen Box" first,
    // rather than silently reopening or allowing the add (product decision,
    // see Seal Box feature discussion).
    if (this.getPackingStatus() === 'sealed') {
      await this.toastService.presentErrorToast(
        'Box is sealed. Reopen it to add items.'
      );
      return;
    }

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

  async updateItem(itemId: string, itemData: Partial<CreateItemDto>) {
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

  deleteItem(itemId: string) {
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

  /**
   * Spec 014 Fix 2: opens an action sheet listing checklists not currently
   * assigned to any box, letting the user attach one to this box directly
   * from box-detail. Goes through `BoxService` (never `LocalChecklistsService`
   * directly), per docs/architecture.md's mandatory layering.
   */
  async onAssignChecklist() {
    if (!this.box) return;

    this.isLoadingAvailableChecklists = true;
    this.boxService.getUnassignedChecklists().subscribe({
      next: async (checklists) => {
        this.isLoadingAvailableChecklists = false;

        if (checklists.length === 0) {
          this.toastService.presentErrorToast(
            'No unassigned checklists available'
          );
          return;
        }

        const actionSheet = await this.actionSheetController.create({
          header: 'Assign a checklist',
          buttons: [
            ...checklists.map((checklist) => ({
              text: checklist.title,
              handler: () => {
                this.assignChecklist(checklist.id);
              },
            })),
            {
              text: 'Cancel',
              role: 'cancel',
            },
          ],
        });
        await actionSheet.present();
      },
      error: () => {
        this.isLoadingAvailableChecklists = false;
        this.toastService.presentErrorToast(
          'Error loading available checklists'
        );
      },
    });
  }

  private assignChecklist(checklistId: string) {
    if (!this.box) return;

    this.boxService.assignChecklistToBox(checklistId, this.box.id).subscribe({
      next: () => {
        this.loadAssignedChecklist();
        this.toastService.presentSuccessToast('Checklist assigned');
      },
      error: () => {
        this.toastService.presentErrorToast('Error assigning checklist');
      },
    });
  }

  /**
   * Spec 014 (optional unassign action): clears the assigned checklist's
   * box link, returning the box to the "no checklist assigned" state.
   */
  onUnassignChecklist() {
    if (!this.assignedChecklist) return;

    this.boxService.unassignChecklist(this.assignedChecklist.id).subscribe({
      next: () => {
        this.loadAssignedChecklist();
        this.toastService.presentSuccessToast('Checklist unassigned');
      },
      error: () => {
        this.toastService.presentErrorToast('Error unassigning checklist');
      },
    });
  }

  // `packingStatus` is optional on the legacy `Box` view-model (Spec 009
  // Step 2) -- defaults to 'packing' if missing.
  getPackingStatus(): 'packing' | 'sealed' {
    return this.box?.packingStatus ?? 'packing';
  }

  async onSealBox() {
    if (!this.box) return;

    if (!this.items || this.items.length === 0) {
      const alert = await this.alertController.create({
        header: 'Seal Box',
        message: 'This box has no items yet. Seal it anyway?',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Seal',
            role: 'confirm',
            handler: () => {
              this.sealBox();
            },
          },
        ],
      });
      await alert.present();
      return;
    }

    this.sealBox();
  }

  private sealBox() {
    this.boxService.sealBox(this.box.id).subscribe({
      next: async (sealedBox) => {
        this.box = sealedBox;
        await this.presentQrFullScreen(sealedBox.qrCode);
      },
      error: () => {
        this.toastService.presentErrorToast('Error sealing box');
      },
    });
  }

  async onReopenBox() {
    if (!this.box) return;

    this.boxService.reopenBox(this.box.id).subscribe({
      next: (reopenedBox) => {
        this.box = reopenedBox;
      },
      error: () => {
        this.toastService.presentErrorToast('Error reopening box');
      },
    });
  }

  private async presentQrFullScreen(qrData: string) {
    const modal = await this.modalController.create({
      component: QrModalComponent,
      componentProps: {
        qrData,
      },
    });
    await modal.present();
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
   * Obtiene la URL de la imagen del item, considerando diferentes posibles propiedades.
   *
   * Prefers the already-resolved (Spec 012, async) value from
   * `itemImageUrls` when available, since that's the one that's been
   * through the durable-storage/dead-blob: handling. Falls back to the
   * legacy qrcode-based lookups below for items that never had a resolved
   * entry (e.g. resolution still in flight).
   */
  getItemImageUrl(item: Item): string | null {
    const resolved = this.itemImageUrls[item.id];
    if (resolved) {
      return resolved;
    }

    // Verificamos si tenemos una URL directa que podemos usar
    if (
      item.imageUrl &&
      typeof item.imageUrl === 'string' &&
      item.imageUrl.trim() !== '' &&
      !item.imageUrl.startsWith('blob:')
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
