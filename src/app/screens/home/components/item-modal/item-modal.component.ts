import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController, LoadingController, Platform } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ToastService } from 'src/app/shared/services/toast.service';
import { Item } from 'src/app/screens/home/models/item.interface';

@Component({
  selector: 'app-item-modal',
  templateUrl: './item-modal.component.html',
  styleUrls: ['./item-modal.component.scss'],
})
export class ItemModalComponent implements OnInit {
  @Input() boxId!: number;
  @Input() item?: Item; // For editing existing items

  itemForm: FormGroup;
  isEditing = false;
  imagePreview: string | null = null;
  selectedFileName: string | null = null;

  constructor(
    private modalController: ModalController,
    private formBuilder: FormBuilder,
    private loadingController: LoadingController,
    private toastService: ToastService,
    private platform: Platform
  ) {
    this.itemForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(255)]],
      quantity: [
        1,
        [Validators.required, Validators.min(1), Validators.max(9999)],
      ],
      isFragile: [false],
      expires: [false],
      expirationDate: [null],
    });
  }

  ngOnInit() {
    if (this.item) {
      this.isEditing = true;

      // Check if the item has expiration information (from the item view that shows this data)
      const itemWithExpiration = this.item as Item & {
        expirationDate?: Date;
        expires?: boolean;
      };
      const hasExpiration =
        itemWithExpiration.expirationDate || itemWithExpiration.expires;

      this.itemForm.patchValue({
        name: this.item.name,
        description: this.item.description || '',
        quantity: this.item.quantity || 1,
        isFragile: this.item.isFragile || false,
        // Set the expires flag and expiration date if available
        expires: hasExpiration ? true : false,
        expirationDate: hasExpiration
          ? itemWithExpiration.expirationDate
          : null,
      });

      this.imagePreview = this.item.imageUrl || null;
      if (this.imagePreview) {
        this.selectedFileName = 'existing-image.jpg';
      }
    }
  }

  async takePicture() {
    try {
      // In web browser, use Photos (gallery) as default source
      const source = this.platform.is('capacitor')
        ? CameraSource.Prompt
        : CameraSource.Photos;

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source,
        width: 300,
        height: 300,
      });

      if (image.dataUrl) {
        this.imagePreview = image.dataUrl;
        this.selectedFileName = `photo-${new Date().getTime()}.jpg`;
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      // If camera fails, try with file input as fallback
      if (!this.platform.is('capacitor')) {
        this.openFileInput();
      } else {
        await this.toastService.presentErrorToast(
          'Error accessing camera/gallery'
        );
      }
    }
  }

  // Fallback method for web browsers
  openFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          this.imagePreview = e.target?.result as string;
          this.selectedFileName = file.name;
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }

  removeImage() {
    this.imagePreview = null;
    this.selectedFileName = null;
  }

  async confirm() {
    if (this.itemForm.valid) {
      const loading = await this.loadingController.create({
        message: this.isEditing ? 'Updating item...' : 'Creating item...',
      });
      await loading.present();

      try {
        const formValue = this.itemForm.value;
        // Adapting the object to match the interface expected by the backend
        const itemData = {
          name: formValue.name,
          description: formValue.description || undefined,
          image: this.imagePreview || undefined,
          quantity: formValue.quantity,
          isFragile: formValue.isFragile,
          expires: formValue.expires,
          expirationDate: formValue.expires
            ? formValue.expirationDate
            : undefined,
        };

        await this.modalController.dismiss(itemData, 'confirm');
      } catch (error) {
        console.error('Error saving item:', error);
        await this.toastService.presentErrorToast('Error saving item');
      } finally {
        await loading.dismiss();
      }
    } else {
      await this.toastService.presentErrorToast(
        'Please fill in all required fields'
      );
    }
  }

  async cancel() {
    return this.modalController.dismiss(null, 'cancel');
  }

  onExpiresChange() {
    const expiresValue = this.itemForm.get('expires')?.value;
    if (expiresValue) {
      // Set default expiration date to tomorrow if not set
      if (!this.itemForm.get('expirationDate')?.value) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        this.itemForm.patchValue({
          expirationDate: tomorrow.toISOString(),
        });
      }
    } else {
      // Clear expiration date if expires is unchecked
      this.itemForm.patchValue({
        expirationDate: null,
      });
    }
  }

  get nameError() {
    const nameControl = this.itemForm.get('name');
    if (nameControl?.hasError('required') && nameControl?.touched) {
      return 'Item name is required';
    }
    if (nameControl?.hasError('maxlength')) {
      return 'Item name must be less than 100 characters';
    }
    return null;
  }

  get descriptionError() {
    const descControl = this.itemForm.get('description');
    if (descControl?.hasError('maxlength')) {
      return 'Description must be less than 255 characters';
    }
    return null;
  }

  get quantityError() {
    const quantityControl = this.itemForm.get('quantity');
    if (quantityControl?.hasError('required') && quantityControl?.touched) {
      return 'Quantity is required';
    }
    if (quantityControl?.hasError('min')) {
      return 'Quantity must be at least 1';
    }
    if (quantityControl?.hasError('max')) {
      return 'Quantity cannot exceed 9999';
    }
    return null;
  }
}
