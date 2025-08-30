import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import {
  Checklist,
  ChecklistItem,
} from '../../../../shared/interfaces/checklist.interface';
import { ChecklistService } from '../../../../shared/services/checklist.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { ItemFormData } from '../../../../shared/components/item-form/item-form.component';
import { ModalController } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { ImageModalComponent } from '../../../../components/image-modal/image-modal.component';

@Component({
  selector: 'app-checklist-items',
  templateUrl: './checklist-items.component.html',
  styleUrls: ['./checklist-items.component.scss'],
})
export class ChecklistItemsComponent {
  @Input() checklist!: Checklist;
  @Output() checklistUpdated = new EventEmitter<void>();

  editingItemIndex: number = -1;
  tempItem: ChecklistItem = this.createEmptyItem();

  constructor(
    private checklistService: ChecklistService,
    private modalController: ModalController,
    private toastService: ToastService
  ) {}

  createEmptyItem(): ChecklistItem {
    return {
      id: 0,
      name: '',
      quantity: 1,
      isCompleted: false,
      isFragile: false,
      expires: false,
      expirationDate: null,
      checklistId: this.checklist?.id || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  addItem() {
    if (this.editingItemIndex !== -1) {
      return; // Already editing
    }

    this.tempItem = this.createEmptyItem();
    this.editingItemIndex = this.checklist.items.length; // Index for new item
    // Don't push to array yet - only show the form
  }

  editItem(index: number) {
    if (this.editingItemIndex !== -1) {
      this.cancelEdit(); // Cancel any existing edit
    }

    this.editingItemIndex = index;
    this.tempItem = { ...this.checklist.items[index] };
  }

  async saveItem() {
    if (this.editingItemIndex === -1 || !this.tempItem.name.trim()) {
      return;
    }

    try {
      const isNewItem = this.editingItemIndex === this.checklist.items.length;

      // Prepare data for sending, including the image if it exists
      type ItemDataWithImage = {
        name: string;
        quantity: number;
        isCompleted: boolean;
        isFragile: boolean;
        expires: boolean;
        expirationDate: Date | null;
        imageData?: string;
      };

      const itemData: ItemDataWithImage = {
        name: this.tempItem.name.trim(),
        quantity: this.tempItem.quantity || 1,
        isCompleted: this.tempItem.isCompleted || false,
        isFragile: this.tempItem.isFragile || false,
        expires: this.tempItem.expires || false,
        expirationDate: this.tempItem.expirationDate || null,
        imageData: (this.tempItem as ChecklistItem & { imageData?: string })
          .imageData,
      };

      if (isNewItem) {
        // Add new item
        const newItem = await this.checklistService
          .addItem(this.checklist.id, itemData)
          .toPromise();

        // Add the new item to the array
        this.checklist.items.push(newItem!);
      } else {
        // Update existing item
        const updatedItem = await this.checklistService
          .updateItem(this.checklist.items[this.editingItemIndex].id, itemData)
          .toPromise();

        // Update the item in local array with the returned item from server
        this.checklist.items[this.editingItemIndex] = updatedItem!;
      }

      this.editingItemIndex = -1;
      this.tempItem = this.createEmptyItem();
      this.checklistUpdated.emit();
    } catch (error) {
      console.error('Error saving item:', error);
    }
  }

  cancelEdit() {
    if (this.editingItemIndex === -1) {
      return;
    }

    // Reset editing state
    this.editingItemIndex = -1;
    this.tempItem = this.createEmptyItem();
  }

  onItemFormSave(formData: ItemFormData) {
    // Update tempItem with form data
    this.tempItem.name = formData.name;
    this.tempItem.quantity = formData.quantity || 1;
    this.tempItem.isFragile = formData.fragile;
    this.tempItem.expires = formData.expires;
    this.tempItem.expirationDate = formData.expirationDate
      ? new Date(formData.expirationDate)
      : null;

    // Handle the image if present
    const tempItemWithImage = this.tempItem as ChecklistItem & {
      imageData?: string;
    };
    if (formData.hasImage && formData.imagePreview) {
      // Extract only the Base64 data (remove the prefix data:image/jpeg;base64,)
      const base64Data = formData.imagePreview.split(',')[1];
      // In tempItem we don't store the image directly but a reference
      // The backend will handle the image data
      tempItemWithImage.imageData = base64Data;
    } else {
      // If the image was deactivated, clear the field
      tempItemWithImage.imageData = null;
    }

    // Call existing saveItem method
    this.saveItem();
  }

  async removeItem(index: number) {
    if (this.editingItemIndex === index) {
      this.cancelEdit();
    }

    try {
      const item = this.checklist.items[index];

      // Only call backend delete if the item has an ID (exists in database)
      if (item.id) {
        await this.checklistService.deleteItem(item.id).toPromise();
      }

      // Remove from local array
      this.checklist.items.splice(index, 1);
      this.checklistUpdated.emit();
    } catch (error) {
      console.error('Error removing item:', error);
    }
  }

  async toggleItemCompletion(index: number) {
    if (this.editingItemIndex === index) {
      return; // Don't toggle while editing
    }

    try {
      const item = this.checklist.items[index];
      const newCompletionState = !item.isCompleted;
      const isCompletingItem = newCompletionState; // Is the item being checked/completed

      // Use the toggle endpoint for better performance
      await this.checklistService.toggleItemCompletion(item.id).toPromise();

      // Update local state
      this.checklist.items[index].isCompleted = newCompletionState;
      this.checklistUpdated.emit();

      // Show notification if the item was completed and the checklist is assigned to a box
      if (isCompletingItem && this.checklist.boxId) {
        await this.toastService.presentInfoToast(
          `"${item.name}" has been added to ${
            this.checklist.box?.name || 'the box'
          }.`
        );
      }
    } catch (error) {
      console.error('Error toggling item:', error);
      // No need to revert since we didn't change local state yet
    }
  }

  onExpiresChange() {
    if (this.tempItem && !this.tempItem.expires) {
      this.tempItem.expirationDate = null;
    }
  }

  toggleExpires() {
    this.tempItem.expires = !this.tempItem.expires;

    if (!this.tempItem.expires) {
      // If disabling expires, clear the date
      this.tempItem.expirationDate = null;
    }
  }

  isEditing(index: number): boolean {
    return this.editingItemIndex === index;
  }

  isNewItem(index: number): boolean {
    return (
      this.editingItemIndex === index && index === this.checklist.items.length
    );
  }

  // Utility methods for template
  getCompletedCount(): number {
    return (
      this.checklist?.items?.filter((item) => item.isCompleted).length || 0
    );
  }

  getTotalCount(): number {
    return this.checklist?.items?.length || 0;
  }

  getCompletionPercentage(): number {
    const total = this.getTotalCount();
    if (total === 0) return 0;
    return Math.round((this.getCompletedCount() / total) * 100);
  }

  toggleItem(item: ChecklistItem) {
    const index = this.checklist.items.indexOf(item);
    if (index !== -1) {
      this.toggleItemCompletion(index);
    }
  }

  deleteItem(item: ChecklistItem) {
    const index = this.checklist.items.indexOf(item);
    if (index !== -1) {
      this.removeItem(index);
    }
  }

  formatDate(date: Date | null): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
  }

  // Method to get the full image URL
  getFullImageUrl(imageUrl: string): string {
    if (!imageUrl) return '';

    // Verify if it already has the domain prefix
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }

    // The backend now returns only the filename, not a path
    // If the input has a path, extract only the filename
    const filename = imageUrl.includes('/')
      ? imageUrl.split('/').pop()
      : imageUrl;

    console.log('Original URL:', imageUrl);
    console.log('Filename to use:', filename);

    // Always use the path with /public/images/
    const fullUrl = `${environment.apiUrl}/public/images/${filename}`;

    console.log('Built URL to access the image:', fullUrl);

    return fullUrl;
  }

  async showItemImage(item: ChecklistItem) {
    if (!item.imageUrl) return;

    console.log('Original image URL:', item.imageUrl);

    // Use the common method to get the full URL
    const fullImageUrl = this.getFullImageUrl(item.imageUrl);

    console.log('Showing image with full URL:', fullImageUrl);

    // Show the modal using the ImageModalComponent
    const modal = await this.modalController.create({
      component: ImageModalComponent,
      componentProps: {
        imageUrl: fullImageUrl,
      },
      cssClass: 'image-modal',
    });

    await modal.present();
  }
}
