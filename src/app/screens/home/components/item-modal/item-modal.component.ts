import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController, LoadingController, Platform } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ToastService } from 'src/app/shared/services/toast.service';
import { Item } from 'src/app/screens/home/models/item.interface';
import { ImageUrlService } from 'src/app/shared/services/image-url.service';

@Component({
  selector: 'app-item-modal',
  templateUrl: './item-modal.component.html',
  styleUrls: ['./item-modal.component.scss'],
})
export class ItemModalComponent implements OnInit {
  @Input() boxId!: string;
  @Input() item?: Item; // For editing existing items

  itemForm: FormGroup;
  isEditing = false;
  imagePreview: string | null = null;
  /**
   * Local file URI persisted to `LocalItem.imageUri` (see docs/specs.md
   * Spec 002 addendum — image upload must produce a local file URI, not a
   * base64 blob). `imagePreview` above stays whatever is displayable in the
   * `<img>` tag (a `webPath`/data URL); `imageUri` is what's actually saved.
   */
  imageUri: string | null = null;
  selectedFileName: string | null = null;

  constructor(
    private modalController: ModalController,
    private formBuilder: FormBuilder,
    private loadingController: LoadingController,
    private toastService: ToastService,
    private platform: Platform,
    private imageUrlService: ImageUrlService
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

      this.imageUri = this.item.imageUrl || null;
      if (this.imageUri) {
        this.selectedFileName = 'existing-image.jpg';
        // Resolution is async (Spec 012) — native/web both go through
        // resolveImageSrc(), which also short-circuits dead blob: rows to
        // null so the placeholder shows instead of a broken <img>.
        this.imageUrlService
          .resolveImageSrc(this.imageUri)
          .then((resolved) => {
            this.imagePreview = resolved;
          });
      } else {
        this.imagePreview = null;
      }
    }
  }

  async takePicture() {
    try {
      // In web browser, use Photos (gallery) as default source
      const source = this.platform.is('capacitor')
        ? CameraSource.Prompt
        : CameraSource.Photos;

      // `Uri` (rather than `DataUrl`) gives back a local file URI/webPath,
      // matching the "store a local file URI, not base64" decision (see
      // docs/specs.md Spec 002 addendum).
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: source,
        width: 300,
        height: 300,
      });

      const uri = image.webPath || image.path;
      if (uri) {
        this.imagePreview = uri;
        this.imageUri = uri;
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
    input.onchange = async (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        // Copy the picked file into durable on-device storage (Spec 012)
        // and store the resulting marker URI, never a
        // `URL.createObjectURL(file)` blob: URL — those only live for the
        // current document lifetime and leave a dead reference in SQLite
        // after any reload.
        const persistedUri = await this.imageUrlService.persistPickedFile(
          file
        );
        this.imageUri = persistedUri;
        this.imagePreview = await this.imageUrlService.resolveImageSrc(
          persistedUri
        );
        this.selectedFileName = file.name;
      }
    };
    input.click();
  }

  removeImage() {
    this.imagePreview = null;
    this.imageUri = null;
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
        // `image` is a local file URI (see `imageUri` above), not base64.
        const itemData = {
          name: formValue.name,
          description: formValue.description || undefined,
          image: this.imageUri || undefined,
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
