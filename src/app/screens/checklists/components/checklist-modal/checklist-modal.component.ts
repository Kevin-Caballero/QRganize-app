import { Component, Input, OnInit } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { LocalChecklistsService } from '../../../../shared/services/local-checklists.service';
import { LocalBoxesService } from '../../../../shared/services/local-boxes.service';
import {
  ChecklistStatus,
  LocalChecklist,
} from '../../../../shared/models/local-checklist';
import { LocalBox } from '../../../../shared/models/local-box';

/**
 * Create/edit modal for `LocalChecklist`. Per docs/specs.md Spec 004, this
 * persists through `LocalChecklistsService` only (Feature Service ->
 * `ChecklistRepository` -> SQLite). Box assignment is optional, restored
 * per Spec 002's "Addendum 2" (`LocalChecklist.boxId`) using
 * `LocalBoxesService` to list boxes for the picker, mirroring how
 * box/item modals already consume their respective local services.
 *
 * When `checklist` is supplied (edit mode), items are managed separately via
 * `ChecklistItemsComponent` on the detail page — this modal only edits the
 * checklist's own fields (title/description/box assignment).
 */
@Component({
  selector: 'app-checklist-modal',
  templateUrl: './checklist-modal.component.html',
  styleUrls: ['./checklist-modal.component.scss'],
})
export class ChecklistModalComponent implements OnInit {
  @Input() checklist?: LocalChecklist;

  loading = false;
  title = '';
  description = '';
  boxId: string | null = null;
  boxes: LocalBox[] = [];

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private localChecklistsService: LocalChecklistsService,
    private localBoxesService: LocalBoxesService
  ) {}

  async ngOnInit() {
    if (this.checklist) {
      this.title = this.checklist.title;
      this.description = this.checklist.description;
      this.boxId = this.checklist.boxId ?? null;
    }

    try {
      this.boxes = await this.localBoxesService.getAllBoxes();
    } catch (error) {
      console.error('Error loading boxes:', error);
      this.boxes = [];
    }
  }

  get isEditMode(): boolean {
    return !!this.checklist;
  }

  dismiss() {
    this.modalController.dismiss();
  }

  async save() {
    if (!this.title?.trim() || this.loading) return;

    this.loading = true;

    try {
      if (this.checklist) {
        await this.localChecklistsService.updateChecklist(this.checklist.id, {
          title: this.title.trim(),
          description: this.description?.trim() ?? '',
          boxId: this.boxId ?? undefined,
        });
      } else {
        await this.localChecklistsService.createChecklist({
          title: this.title.trim(),
          description: this.description?.trim() ?? '',
          status: ChecklistStatus.ACTIVE,
          boxId: this.boxId ?? undefined,
        });
      }

      this.modalController.dismiss(true);
    } catch (error) {
      console.error('Error saving checklist:', error);
      const alert = await this.alertController.create({
        header: 'Error',
        message: 'Failed to save checklist. Please try again.',
        buttons: ['OK'],
      });
      await alert.present();
    } finally {
      this.loading = false;
    }
  }
}
