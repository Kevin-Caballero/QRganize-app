import { Component, OnInit } from '@angular/core';
import { BoxService } from '../../services/box.service';
import { Box } from '../../models/box.interface';
import {
  InfiniteScrollCustomEvent,
  IonInfiniteScrollCustomEvent,
} from '@ionic/core';
import { BoxStateService } from '../../services/box-state.service';
import {
  AlertController,
  ModalController,
  NavController,
} from '@ionic/angular';
import { ToastService } from 'src/app/shared/services/toast.service';
import { MessageService } from 'src/app/shared/services/message.service';
import { EntityType } from 'src/app/shared/models/entity-type.enum';
import { ErrorHandlerService } from 'src/app/shared/services/error-handler.service';
import { QrModalComponent } from '../qr-modal/qr-modal.component';
import { ItemService } from '../../services/item.service';
import { forkJoin, Observable, of } from 'rxjs';
import { ChecklistService } from 'src/app/shared/services/checklist.service';
import { Checklist } from 'src/app/shared/interfaces/checklist.interface';
import { catchError, map } from 'rxjs/operators';

@Component({
  selector: 'app-box-list',
  templateUrl: './box-list.component.html',
  styleUrls: ['./box-list.component.scss'],
})
export class BoxListComponent implements OnInit {
  boxes: Box[] = [];
  count: number;
  boxItemCounts: { [boxId: number]: number } = {};
  boxChecklistMap: { [boxId: number]: Checklist | null } = {};
  boxItemProperties: {
    [boxId: number]: {
      hasFragileItems: boolean;
      hasExpiringItems: boolean;
      hasImagesItems: boolean;
    };
  } = {};

  // Para selección múltiple
  isSelectionMode = false;
  selectedBoxes: Box[] = [];
  longPressActive = false;

  constructor(
    private boxStateService: BoxStateService,
    private alertController: AlertController,
    private toastService: ToastService,
    private messageService: MessageService,
    private errorHandlerService: ErrorHandlerService,
    private navController: NavController,
    private modalController: ModalController,
    private itemService: ItemService,
    private checklistService: ChecklistService
  ) {}

  ngOnInit() {
    // Pequeño delay para asegurar que el token esté disponible
    setTimeout(() => {
      this.boxStateService.loadBoxes();
    }, 300);

    this.boxStateService.boxes$.subscribe((data) => {
      this.boxes = data.data;
      this.count = data.count;
      this.loadItemCounts();
      this.loadChecklists();
    });
  }

  private loadChecklists() {
    if (this.boxes.length === 0) {
      return;
    }

    // Cargamos todos los checklists una sola vez
    this.checklistService.getChecklists().subscribe({
      next: (checklists) => {
        this.boxChecklistMap = {};

        // Mapeamos cada checklist a su caja
        this.boxes.forEach((box) => {
          if (box.id) {
            const checklist = checklists.find((cl) => cl.boxId === box.id);
            this.boxChecklistMap[box.id] = checklist || null;
          }
        });
      },
      error: (error) => {
        console.warn('Error loading checklists:', error);
      },
    });
  }

  private loadItemCounts() {
    if (this.boxes.length === 0) {
      return;
    }

    // Create array of observables to get item count for each box
    const itemCountRequests = this.boxes.map((box) =>
      this.itemService.getItemsByBox(box.id!)
    );

    // Execute all requests in parallel
    forkJoin(itemCountRequests).subscribe({
      next: (results) => {
        this.boxItemCounts = {};
        this.boxItemProperties = {};

        results.forEach((items, index) => {
          const boxId = this.boxes[index].id!;
          this.boxItemCounts[boxId] = items.length;

          // Analizar propiedades de los items
          let hasFragileItems = false;
          let hasExpiringItems = false;
          let hasImagesItems = false;

          items.forEach((item) => {
            if (item.isFragile) hasFragileItems = true;
            if (item.expires && item.expirationDate) hasExpiringItems = true;
            if (item.imageUrl) hasImagesItems = true;
          });

          this.boxItemProperties[boxId] = {
            hasFragileItems,
            hasExpiringItems,
            hasImagesItems,
          };
        });
      },
      error: (error) => {
        console.warn('Error loading item counts:', error);
        // Initialize with zeros if error
        this.boxItemCounts = {};
        this.boxItemProperties = {};

        this.boxes.forEach((box) => {
          if (box.id) {
            this.boxItemCounts[box.id] = 0;
            this.boxItemProperties[box.id] = {
              hasFragileItems: false,
              hasExpiringItems: false,
              hasImagesItems: false,
            };
          }
        });
      },
    });
  }

  // Método público para refrescar los datos desde la página principal
  public refreshData() {
    this.boxStateService.loadBoxes();
    // Los checklists se actualizarán automáticamente gracias a la suscripción
  }

  getItemCount(box: Box): number {
    return box.id ? this.boxItemCounts[box.id] || 0 : 0;
  }

  hasChecklist(box: Box): boolean {
    return box.id ? !!this.boxChecklistMap[box.id] : false;
  }

  getChecklistName(box: Box): string | null {
    return box.id && this.boxChecklistMap[box.id]
      ? this.boxChecklistMap[box.id]?.name || null
      : null;
  }

  hasFragileItems(box: Box): boolean {
    return box.id && this.boxItemProperties[box.id]
      ? this.boxItemProperties[box.id].hasFragileItems
      : false;
  }

  hasExpiringItems(box: Box): boolean {
    return box.id && this.boxItemProperties[box.id]
      ? this.boxItemProperties[box.id].hasExpiringItems
      : false;
  }

  hasItemsWithImages(box: Box): boolean {
    return box.id && this.boxItemProperties[box.id]
      ? this.boxItemProperties[box.id].hasImagesItems
      : false;
  }

  onIonInfinite($event: IonInfiniteScrollCustomEvent<void>) {
    // this.generateItems();
    console.log(
      '%c [  ]-60',
      'font-size:13px; background:pink; color:#bf2c9f;',
      this.boxes.length,
      this.count
    );
    if (this.boxes.length !== this.count) {
      this.boxStateService.loadBoxes({
        page: this.boxStateService.page + 1,
        size: this.boxStateService.size,
      });
      setTimeout(() => {
        ($event as InfiniteScrollCustomEvent).target.complete();
      }, 500);
    } else {
      ($event as InfiniteScrollCustomEvent).target.disabled = true;
    }
  }

  onBoxSelected(box: Box) {
    if (this.isSelectionMode) {
      this.toggleBoxSelection(box);
    } else {
      this.navController.navigateForward(`/tabs/home/box/${box.id}`);
    }
  }

  // Manejo de long press para iniciar selección múltiple
  onLongPress(box: Box, event: Event) {
    event.preventDefault();
    if (!this.isSelectionMode) {
      this.isSelectionMode = true;
      this.toggleBoxSelection(box);
      // Feedback táctil si está disponible
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    }
  }

  // Alternar selección de una caja
  toggleBoxSelection(box: Box) {
    const index = this.selectedBoxes.findIndex((b) => b.id === box.id);
    if (index === -1) {
      this.selectedBoxes.push(box);
    } else {
      this.selectedBoxes.splice(index, 1);
      // Si no quedan cajas seleccionadas, salir del modo selección
      if (this.selectedBoxes.length === 0) {
        this.exitSelectionMode();
      }
    }
  }

  // Verificar si una caja está seleccionada
  isBoxSelected(box: Box): boolean {
    return this.selectedBoxes.some((b) => b.id === box.id);
  }

  // Salir del modo de selección
  exitSelectionMode() {
    this.isSelectionMode = false;
    this.selectedBoxes = [];
  }

  // Imprimir múltiples QR
  async printMultipleQRs() {
    if (this.selectedBoxes.length === 0) return;

    const qrCodes = this.selectedBoxes.map((box) => ({
      name: box.name,
      qrCode: box.qrCode,
    }));

    const modal = await this.modalController.create({
      component: QrModalComponent,
      componentProps: {
        multipleQrCodes: qrCodes,
        isMultiple: true,
      },
    });

    await modal.present();

    // Al cerrar el modal, salimos del modo selección
    modal.onDidDismiss().then(() => {
      this.exitSelectionMode();
    });
  }

  async onQrSelected(box: Box, event: Event) {
    event.stopPropagation();
    const modal = await this.modalController.create({
      component: QrModalComponent,
      componentProps: {
        qrData: box.qrCode,
      },
    });
    await modal.present();
  }

  async onDelete(box: Box, event: Event) {
    event.stopPropagation();
    const alert = await this.alertController.create({
      header: 'Box Deletion',
      subHeader: `Are you sure you want to delete '${box.name}' box?`,
      message: 'This action cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'Cancel',
        },
        {
          text: 'Delete',
          role: 'Delete',
        },
      ],
    });

    await alert.present();

    const { role } = await alert.onDidDismiss();

    if (role === 'Delete') {
      this.boxStateService.deleteBox(box);
    }
  }

  async openCreateModal() {
    // Dispara un evento personalizado en el document, que la home page está escuchando
    const customEvent = new CustomEvent('createBox');
    document.dispatchEvent(customEvent);
  }
}
