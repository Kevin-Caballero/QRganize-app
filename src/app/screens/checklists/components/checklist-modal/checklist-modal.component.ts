import { Component, Input, OnChanges } from '@angular/core';
import {
  ModalController,
  AlertController,
  ToastController,
} from '@ionic/angular';
import { ChecklistService } from '../../../../shared/services/checklist.service';
import { ChecklistItem } from '../../../../shared/interfaces/checklist.interface';
import { Box } from '../../../home/models/box.interface';
import { ItemFormData } from '../../../../shared/components/item-form/item-form.component';
import { ImageModalComponent } from '../../../../components/image-modal/image-modal.component';

@Component({
  selector: 'app-checklist-modal',
  templateUrl: './checklist-modal.component.html',
  styleUrls: ['./checklist-modal.component.scss'],
})
export class ChecklistModalComponent implements OnChanges {
  @Input() boxes: Box[] = [];

  loading = false;
  items: ChecklistItem[] = [];
  selectedBoxId: number | null = null;
  checklistName: string = '';
  boxesWithChecklists: number[] = []; // Track which boxes already have checklists
  availableBoxes: Box[] = []; // Cached available boxes

  // Shopping list functionality
  editingItemIndex: number | null = null;
  tempItem: Partial<ChecklistItem> = {};

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private checklistService: ChecklistService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    // Start empty for new checklist
    console.log('ChecklistModal - Available boxes:', this.boxes);
    this.loadExistingChecklists();
  }

  ngOnChanges() {
    // Reload checklists when boxes change
    if (this.boxes && this.boxes.length > 0) {
      this.loadExistingChecklists();
    } else {
      // If no boxes, clear available boxes
      this.availableBoxes = [];
    }
  }

  async loadExistingChecklists() {
    try {
      const checklists = await this.checklistService
        .getChecklists()
        .toPromise();
      if (checklists) {
        // Extract box IDs that already have checklists assigned
        this.boxesWithChecklists = checklists
          .filter((checklist) => checklist.boxId) // Only checklists with assigned boxes
          .map((checklist) => checklist.boxId!);

        console.log('Boxes with checklists:', this.boxesWithChecklists);

        // Update available boxes
        this.updateAvailableBoxes();
      }
    } catch (error) {
      console.warn('Failed to load existing checklists:', error);
      // Continue without filtering if we can't load checklists
      this.availableBoxes = [...this.boxes];
    }
  }

  updateAvailableBoxes() {
    // Filter out boxes that already have checklists assigned
    this.availableBoxes = this.boxes.filter(
      (box) => !this.boxesWithChecklists.includes(box.id!)
    );

    console.log('Available boxes (filtered):', this.availableBoxes);
  }

  dismiss() {
    this.modalController.dismiss();
  }

  getAvailableBoxes(): Box[] {
    return this.availableBoxes;
  }

  getSelectedBoxName(): string {
    const selectedBox = this.availableBoxes.find(
      (box) => box.id === this.selectedBoxId
    );
    return selectedBox ? selectedBox.name : '';
  }

  async onBoxSelectClick() {
    console.log(
      'onBoxSelectClick called, availableBoxes.length:',
      this.availableBoxes.length
    );

    if (this.availableBoxes.length === 0) {
      const toast = await this.toastController.create({
        message:
          'No boxes available. All boxes already have checklists assigned.',
        duration: 3000,
        position: 'top',
        color: 'warning',
        icon: 'warning-outline',
      });
      await toast.present();
      console.log('Toast presented');
    }
  }

  // Shopping list methods
  addNewItem() {
    // Add a new temporary item in editing mode
    const newItem: ChecklistItem = {
      id: Date.now(), // Temporary ID
      name: '',
      quantity: 1,
      isCompleted: false,
      isFragile: false,
      expires: false,
      expirationDate: null,
      checklistId: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.items.push(newItem);
    this.editingItemIndex = this.items.length - 1;
    this.tempItem = { ...newItem };
  }

  editItem(index: number) {
    // Cancel any existing edit first
    if (this.editingItemIndex !== null) {
      this.cancelEdit();
    }

    // Start editing the selected item
    this.editingItemIndex = index;
    this.tempItem = { ...this.items[index] };
  }

  saveItem(index: number) {
    if (!this.tempItem.name?.trim()) {
      // If name is empty, remove the item
      this.cancelEdit();
      return;
    }

    // Update the item with tempItem data
    this.items[index] = {
      ...this.items[index],
      ...this.tempItem,
      name: this.tempItem.name!.trim(),
    };

    this.editingItemIndex = null;
    this.tempItem = {};
  }

  cancelEdit() {
    if (this.editingItemIndex !== null) {
      // If it's a new item (empty name), remove it
      if (!this.items[this.editingItemIndex].name) {
        this.items.splice(this.editingItemIndex, 1);
      }
      this.editingItemIndex = null;
      this.tempItem = {};
    }
  }

  onItemFormSave(formData: ItemFormData) {
    if (this.editingItemIndex !== null) {
      if (!formData.name || !formData.name.trim()) {
        // If name is empty, remove the item
        this.removeItem(this.editingItemIndex);
      } else {
        // Update the item with form data
        this.items[this.editingItemIndex] = {
          ...this.items[this.editingItemIndex],
          name: formData.name.trim(),
          quantity: formData.quantity || 1,
          isFragile: formData.fragile,
          expires: formData.expires,
          expirationDate: formData.expirationDate
            ? new Date(formData.expirationDate)
            : null,
          imageUrl: formData.hasImage
            ? formData.imagePreview || 'photo-placeholder.jpg'
            : undefined,
        };
      }

      this.editingItemIndex = null;
      this.tempItem = {};
    }
  }

  cancelAddItem() {
    // Legacy method for compatibility - not used anymore
  }

  confirmAddItem() {
    // Legacy method for compatibility - not used anymore
  }

  toggleItem(index: number) {
    const item = this.items[index];
    item.isCompleted = !item.isCompleted;
  }

  removeItem(index: number) {
    this.items.splice(index, 1);
  }

  getCompletedCount(): number {
    return this.items.filter((item) => item.isCompleted).length;
  }

  getProgressPercentage(): number {
    if (this.items.length === 0) return 0;
    return this.getCompletedCount() / this.items.length;
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString();
  }

  onExpiresChange() {
    if (this.tempItem && !this.tempItem.expires) {
      this.tempItem.expirationDate = null;
    }
  }

  async save() {
    if (!this.checklistName?.trim() || this.loading) return;

    this.loading = true;

    try {
      // Create new checklist with user-provided name
      const selectedBox = this.boxes.find(
        (box) => box.id === this.selectedBoxId
      );

      const newChecklist = await this.checklistService
        .createChecklist({
          name: this.checklistName.trim(),
          description: selectedBox
            ? `Checklist for ${selectedBox.name}`
            : 'Personal checklist',
        })
        .toPromise();

      if (newChecklist) {
        // Assign to box if a box was selected
        if (this.selectedBoxId) {
          try {
            await this.checklistService
              .assignToBox(newChecklist.id!, this.selectedBoxId)
              .toPromise();
          } catch (assignError: any) {
            console.warn('Box assignment failed:', assignError);
            // Show a warning to the user but continue with checklist creation
            if (
              assignError?.error?.message?.includes('already has a checklist')
            ) {
              const warningAlert = await this.alertController.create({
                header: 'Warning',
                message:
                  'The selected box already has a checklist assigned. Your checklist was created but not assigned to the box.',
                buttons: ['OK'],
              });
              await warningAlert.present();
            }
          }
        }

        // Add all items to the new checklist
        if (this.items.length > 0) {
          for (const item of this.items) {
            await this.checklistService
              .addItem(newChecklist.id!, {
                name: item.name,
                quantity: item.quantity || 1,
                isCompleted: item.isCompleted,
                isFragile: item.isFragile,
                expires: item.expires,
                expirationDate: item.expirationDate,
                imageData:
                  item.imageUrl && item.imageUrl.startsWith('data:')
                    ? item.imageUrl
                    : undefined,
              })
              .toPromise();
          }
        }
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

  toggleExpires() {
    if (this.tempItem) {
      this.tempItem.expires = !this.tempItem.expires;

      if (!this.tempItem.expires) {
        // If disabling expires, clear the date
        this.tempItem.expirationDate = null;
      }
    }
  }

  async openImageModal(imageUrl: string) {
    if (!imageUrl) return;

    const modal = await this.modalController.create({
      component: ImageModalComponent,
      componentProps: {
        imageUrl: imageUrl,
      },
      cssClass: 'image-preview-modal',
    });

    await modal.present();
  }
}
