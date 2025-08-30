import { Injectable } from '@angular/core';
import { Box } from '../models/box.interface';
import { BehaviorSubject, map, Observable, Subject } from 'rxjs';
import { BoxService } from './box.service';
import { PaginationOptions } from 'src/app/shared/models/pagination-options';
import { BoxReqDto } from '../models/box-req.dto';
import { PaginationResult } from 'src/app/shared/models/pagination-result';
import { ModalController } from '@ionic/angular';
import { ToastService } from 'src/app/shared/services/toast.service';
import { MessageService } from 'src/app/shared/services/message.service';
import { EntityType } from 'src/app/shared/models/entity-type.enum';

@Injectable({
  providedIn: 'root',
})
export class BoxStateService {
  private boxesSubject = new BehaviorSubject<PaginationResult<Box>>({
    data: [],
    count: 0,
  });
  public boxes$ = this.boxesSubject.asObservable();
  public page: number = 1;
  public size: number = 10;

  constructor(
    private boxService: BoxService,
    private modalController: ModalController,
    private toastService: ToastService,
    private messageService: MessageService
  ) {
    // No cargar las cajas inmediatamente en el constructor
    // Se cargarán cuando el componente lo solicite explícitamente
  }

  loadBoxes(pagination: PaginationOptions = { page: 1, size: 10 }) {
    this.page = pagination.page;
    this.size = pagination.size;
    this.boxService.getBoxes(pagination).subscribe({
      next: (data) => {
        this.boxesSubject.next({
          data: data[0],
          count: data[1],
        } as PaginationResult<Box>);
      },
      error: () => {
        // Manejo silencioso del error
      },
    });
  }

  // Variable para trackear si una operación de crear box está en curso
  private creatingBox = false;

  createBox(data: BoxReqDto) {
    // Evitar peticiones duplicadas
    if (this.creatingBox) {
      console.log(
        'Create box operation already in progress, ignoring duplicate request.'
      );
      return;
    }

    this.creatingBox = true;

    this.boxService.createBox(data).subscribe({
      next: (newBox) => {
        this.creatingBox = false;
        this.modalController.dismiss();
        const current = this.boxesSubject.value;
        this.boxesSubject.next({
          data: [newBox, ...current.data],
          count: current.count + 1,
        });
        this.toastService.presentSuccessToast(
          this.messageService.create(EntityType.BOX, newBox.name)
        );
      },
      error: (error) => {
        this.creatingBox = false;
        console.error('Error creating box:', error);
        this.toastService.presentErrorToast('Error creating box');
      },
    });
  }

  deleteBox(box: Box) {
    this.boxService.deleteBox(box).subscribe({
      next: () => {
        const current = this.boxesSubject.value;
        const filtered = current.data.filter((b) => b.id !== box.id);
        this.boxesSubject.next({
          data: filtered,
          count: current.count - 1,
        });
        this.toastService.presentSuccessToast(
          this.messageService.delete(EntityType.BOX, box.name)
        );
      },
      error: () => {
        this.toastService.presentErrorToast('Error deleting box');
      },
    });
  }

  updateBox(boxId: number, data: BoxReqDto) {
    return this.boxService.updateBox(boxId, data).subscribe({
      next: (updatedBox) => {
        const current = this.boxesSubject.value;
        const index = current.data.findIndex((b) => b.id === boxId);
        if (index !== -1) {
          const updatedBoxes = [...current.data];
          updatedBoxes[index] = updatedBox;
          this.boxesSubject.next({
            data: updatedBoxes,
            count: current.count,
          });
        }
        this.modalController.dismiss();
        this.toastService.presentSuccessToast(
          this.messageService.update(EntityType.BOX, updatedBox.name)
        );
      },
      error: () => {
        this.toastService.presentErrorToast('Error updating box');
        this.modalController.dismiss();
      },
    });
  }

  getBoxById(id: string): Observable<Box | undefined> {
    return this.boxes$.pipe(
      map((data) => data.data.find((box) => box.id === +id))
    );
  }
}
