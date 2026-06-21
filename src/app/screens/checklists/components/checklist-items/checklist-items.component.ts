import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ModalController, Platform } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { LocalChecklistsService } from '../../../../shared/services/local-checklists.service';
import { LocalChecklistItem } from '../../../../shared/models/local-checklist';
import { ImageModalComponent } from '../../../../components/image-modal/image-modal.component';

/**
 * Checklist items list/editor for a single checklist. Per docs/specs.md
 * Spec 004, persists through `LocalChecklistsService` only (Feature Service
 * -> `ChecklistRepository` -> SQLite).
 *
 * `LocalChecklistItem` (per Spec 002's "Addendum 2") models
 * `title`/`notes`/`isCompleted`/`sortOrder` plus the originally-specified
 * `quantity`/`isFragile`/`expires`/`expirationDate`/`imageUri` fields — this
 * component edits all of them, mirroring the item-form fields used for
 * `LocalItem` on the home screen.
 */
@Component({
  selector: 'app-checklist-items',
  templateUrl: './checklist-items.component.html',
  styleUrls: ['./checklist-items.component.scss'],
})
export class ChecklistItemsComponent {
  @Input() checklistId!: string;
  @Input() items: LocalChecklistItem[] = [];
  @Output() checklistUpdated = new EventEmitter<void>();

  editingItemIndex = -1;
  tempTitle = '';
  tempNotes = '';
  tempQuantity = 1;
  tempIsFragile = false;
  tempExpires = false;
  tempExpirationDate?: string;
  tempImageUri?: string;

  constructor(
    private localChecklistsService: LocalChecklistsService,
    private modalController: ModalController,
    private platform: Platform
  ) {}

  private resetTemp() {
    this.tempTitle = '';
    this.tempNotes = '';
    this.tempQuantity = 1;
    this.tempIsFragile = false;
    this.tempExpires = false;
    this.tempExpirationDate = undefined;
    this.tempImageUri = undefined;
  }

  addItem() {
    if (this.editingItemIndex !== -1) {
      return; // Already editing
    }

    this.resetTemp();
    this.editingItemIndex = this.items.length; // Index for new item
  }

  editItem(index: number) {
    if (this.editingItemIndex !== -1) {
      this.cancelEdit();
    }

    const item = this.items[index];
    this.editingItemIndex = index;
    this.tempTitle = item.title;
    this.tempNotes = item.notes;
    this.tempQuantity = item.quantity ?? 1;
    this.tempIsFragile = item.isFragile ?? false;
    this.tempExpires = item.expires ?? false;
    this.tempExpirationDate = item.expirationDate;
    this.tempImageUri = item.imageUri;
  }

  async saveItem() {
    if (this.editingItemIndex === -1 || !this.tempTitle.trim()) {
      return;
    }

    try {
      const isNewItem = this.editingItemIndex === this.items.length;

      const fields = {
        title: this.tempTitle.trim(),
        notes: this.tempNotes?.trim() ?? '',
        quantity: this.tempQuantity || 1,
        isFragile: this.tempIsFragile,
        expires: this.tempExpires,
        expirationDate: this.tempExpires ? this.tempExpirationDate : undefined,
        imageUri: this.tempImageUri,
      };

      if (isNewItem) {
        const newItem = await this.localChecklistsService.createChecklistItem({
          checklistId: this.checklistId,
          isCompleted: false,
          ...fields,
        });
        this.items.push(newItem);
      } else {
        const updatedItem = await this.localChecklistsService.updateChecklistItem(
          this.items[this.editingItemIndex].id,
          fields
        );
        this.items[this.editingItemIndex] = updatedItem;
      }

      this.editingItemIndex = -1;
      this.resetTemp();
      this.checklistUpdated.emit();
    } catch (error) {
      console.error('Error saving checklist item:', error);
    }
  }

  cancelEdit() {
    if (this.editingItemIndex === -1) {
      return;
    }

    this.editingItemIndex = -1;
    this.resetTemp();
  }

  onExpiresChange() {
    if (!this.tempExpires) {
      this.tempExpirationDate = undefined;
    }
  }

  async takePicture() {
    try {
      const source = this.platform.is('capacitor')
        ? CameraSource.Prompt
        : CameraSource.Photos;

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source,
        width: 300,
        height: 300,
      });

      const uri = image.webPath || image.path;
      if (uri) {
        this.tempImageUri = uri;
      }
    } catch (error) {
      console.error('Error taking picture:', error);
    }
  }

  removeImage() {
    this.tempImageUri = undefined;
  }

  async removeItem(index: number) {
    if (this.editingItemIndex === index) {
      this.cancelEdit();
    }

    try {
      const item = this.items[index];
      await this.localChecklistsService.deleteChecklistItem(item.id);
      this.items.splice(index, 1);
      this.checklistUpdated.emit();
    } catch (error) {
      console.error('Error removing checklist item:', error);
    }
  }

  async toggleItemCompletion(index: number) {
    if (this.editingItemIndex === index) {
      return; // Don't toggle while editing
    }

    try {
      const item = this.items[index];
      const newCompletionState = !item.isCompleted;

      const updatedItem = await this.localChecklistsService.updateChecklistItem(
        item.id,
        { isCompleted: newCompletionState }
      );

      this.items[index] = updatedItem;
      this.checklistUpdated.emit();
    } catch (error) {
      console.error('Error toggling checklist item:', error);
    }
  }

  isEditing(index: number): boolean {
    return this.editingItemIndex === index;
  }

  isNewItem(index: number): boolean {
    return this.editingItemIndex === index && index === this.items.length;
  }

  getCompletedCount(): number {
    return this.items.filter((item) => item.isCompleted).length;
  }

  getTotalCount(): number {
    return this.items.length;
  }

  getCompletionPercentage(): number {
    const total = this.getTotalCount();
    if (total === 0) return 0;
    return Math.round((this.getCompletedCount() / total) * 100);
  }

  toggleItem(item: LocalChecklistItem) {
    const index = this.items.indexOf(item);
    if (index !== -1) {
      this.toggleItemCompletion(index);
    }
  }

  deleteItem(item: LocalChecklistItem) {
    const index = this.items.indexOf(item);
    if (index !== -1) {
      this.removeItem(index);
    }
  }

  formatDate(date?: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
  }

  async showItemImage(item: LocalChecklistItem) {
    if (!item.imageUri) return;

    const modal = await this.modalController.create({
      component: ImageModalComponent,
      componentProps: {
        imageUrl: item.imageUri,
      },
      cssClass: 'image-modal',
    });

    await modal.present();
  }
}
