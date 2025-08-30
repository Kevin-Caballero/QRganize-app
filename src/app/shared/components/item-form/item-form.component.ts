import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';

export interface ItemFormData {
  name: string;
  quantity?: number;
  fragile: boolean;
  expires: boolean;
  expirationDate?: string;
  imagePreview?: string;
  hasImage?: boolean;
  imagePath?: string;
}

@Component({
  selector: 'app-item-form',
  templateUrl: './item-form.component.html',
  styleUrls: ['./item-form.component.scss'],
})
export class ItemFormComponent implements OnInit {
  @Input() initialData: ItemFormData = {
    name: '',
    quantity: 1,
    fragile: false,
    expires: false,
    hasImage: false,
  };

  @Input() showSaveButton: boolean = true;
  @Input() saveButtonText: string = 'SAVE';
  @Input() showCancelButton: boolean = true;
  @Input() cancelButtonText: string = 'CANCEL';
  @Input() showQuantity: boolean = true;
  @Input() showImage: boolean = true;

  @Output() save = new EventEmitter<ItemFormData>();
  @Output() cancel = new EventEmitter<void>();

  formData: ItemFormData = {
    name: '',
    quantity: 1,
    fragile: false,
    expires: false,
    hasImage: false,
  };

  showDatePicker: boolean = false;
  currentView: 'date' | 'month-year' = 'date';
  minDate: string = new Date().toISOString();

  ngOnInit() {
    this.formData = { ...this.initialData };
    // Set the minimum date as today
    this.minDate = new Date().toISOString();
  }

  toggleFragile() {
    this.formData.fragile = !this.formData.fragile;
  }

  openDatePicker() {
    // If we already have an expiration date, open the datepicker to modify it
    if (this.formData.expires) {
      this.showDatePicker = true;
      return;
    }

    // If this is the first time the expiration date is activated
    this.formData.expires = true;
    if (!this.formData.expirationDate) {
      // Set tomorrow as the default date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      this.formData.expirationDate = tomorrow.toISOString();
    }

    // Show the date picker
    this.showDatePicker = true;
  }

  toggleExpires() {
    this.formData.expires = !this.formData.expires;
    if (!this.formData.expires) {
      // If expiration is deactivated, remove the date
      this.formData.expirationDate = undefined;
      this.showDatePicker = false;
    } else if (!this.formData.expirationDate) {
      // If expiration is activated and there is no date, set tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      this.formData.expirationDate = tomorrow.toISOString();
      // Show the date picker
      this.showDatePicker = true;
    }
  }

  // Method to handle changes in the selected date
  onExpiresChange(event: CustomEvent) {
    if (event && event.detail && (event.detail as { value: string }).value) {
      this.formData.expirationDate = (event.detail as { value: string }).value;
      // Make sure the expires property is activated
      this.formData.expires = true;
      // Don't close automatically to allow the user to confirm their selection
    }
  }

  // Method to manually hide the datepicker
  hideDatePicker() {
    // Close the calendar without confirming the date
    this.showDatePicker = false;
  }

  // Method to confirm the selected date
  confirmDate() {
    if (this.formData.expirationDate) {
      // Make sure the expires property is activated
      this.formData.expires = true;
      // Close the datepicker and keep the selected date
      this.showDatePicker = false;
    } else {
      // If there is no date, set current date + 1 day
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      this.formData.expirationDate = tomorrow.toISOString();
      this.formData.expires = true;
      this.showDatePicker = false;
    }
  }

  // Method to toggle between calendar view and month/year view
  toggleCalendarView() {
    this.currentView = this.currentView === 'date' ? 'month-year' : 'date';
  }

  onSave() {
    if (this.formData.name.trim()) {
      this.save.emit({ ...this.formData });
    }
  }

  onCancel() {
    this.cancel.emit();
  }

  async takePicture() {
    // Simulate camera functionality - in real app would use Capacitor Camera
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          this.formData.imagePreview = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }

  toggleImage() {
    // Toggle the hasImage property of the form
    this.formData.hasImage = !this.formData.hasImage;

    // If image is activated, take a photo
    if (this.formData.hasImage) {
      this.takePicture();
    } else {
      // If deactivated, clear image data
      this.formData.imagePreview = undefined;
      this.formData.imagePath = undefined;
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
  }

  getFormattedMonthYear(): string {
    if (!this.formData.expirationDate) return '';
    const date = new Date(this.formData.expirationDate);
    return date.toLocaleDateString('es', {
      month: 'long',
      year: 'numeric',
    });
  }
}
