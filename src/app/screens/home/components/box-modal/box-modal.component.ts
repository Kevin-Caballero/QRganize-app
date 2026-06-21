import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertController, ModalController, Platform } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Box } from '../../models/box.interface';
import { Subject } from 'rxjs';
import { BoxReqDto } from '../../models/box-req.dto';
import { LocalChecklistsService } from 'src/app/shared/services/local-checklists.service';
import { LocalChecklist } from 'src/app/shared/models/local-checklist';
import { environment } from 'src/environments/environment';
import { ImageUrlService } from 'src/app/shared/services/image-url.service';
import { BoxService } from '../../services/box.service';
import { ItemService } from '../../services/item.service';
import { ToastService } from 'src/app/shared/services/toast.service';
import { Item } from '../../models/item.interface';

@Component({
  selector: 'app-box-modal',
  templateUrl: './box-modal.component.html',
  styleUrls: ['./box-modal.component.scss'],
})
export class BoxModalComponent implements OnInit {
  @ViewChild('fileInput', { static: false })
  fileInput!: ElementRef<HTMLInputElement>;
  @Input() boxSubject!: Subject<BoxReqDto>;
  @Input() box?: Box; // Box existente para editar
  @Output() onConfirmEvent = new EventEmitter<Box>();

  boxForm: FormGroup = new FormGroup({});
  selectedImageUrl: string = '';
  selectedFileName: string | null = null;
  /** Display-only resolved preview, same role as `ItemModalComponent.imagePreview`. */
  imagePreview: string | null = null;
  descriptionMaxLength = 255;
  nameMaxLength = 50;
  isEditMode = false;

  // Variables to handle checklists
  availableChecklists: LocalChecklist[] = [];
  isLoadingChecklists = false;

  // Room grouping (Spec 009 Step 3): fixed list + "Other" free-text fallback,
  // still persisted into the same `room: string` column (no schema change).
  roomOptions: string[] = [
    'Living Room',
    'Kitchen',
    'Bedroom',
    'Bathroom',
    'Garage',
    'Office',
    'Storage',
  ];
  isOtherRoomSelected = false;

  // Consolidated create + add-items flow (Spec 009 Step 4). Only the create
  // path (isEditMode === false) ever transitions to 'items' — edit mode
  // always stays on 'box' and dismisses immediately as before.
  step: 'box' | 'items' = 'box';
  createdBox: Box | null = null;
  addedItems: Item[] = [];
  isAddingItem = false;
  itemForm: FormGroup = new FormGroup({});

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private formBuilder: FormBuilder,
    private localChecklistsService: LocalChecklistsService,
    private imageUrlService: ImageUrlService,
    private boxService: BoxService,
    private itemService: ItemService,
    private toastService: ToastService,
    private platform: Platform
  ) {}

  ngOnInit() {
    this.isEditMode = !!this.box;

    this.boxForm = this.formBuilder.group({
      name: [
        this.box?.name || '',
        [Validators.required, Validators.maxLength(this.nameMaxLength)],
      ],
      description: [
        this.box?.description || '',
        Validators.maxLength(this.descriptionMaxLength),
      ],
      image: [''],
      checklistId: [null], // Field for the selected checklist
      room: ['Other'],
      roomOther: [''],
    });

    // Pre-fill the room select/free-text from an existing box's value. If it
    // doesn't match any item in the fixed list (e.g. set via free-text
    // previously, or empty), show "Other" pre-selected with the existing
    // value pre-filled rather than losing it.
    const existingRoom = this.box?.room ?? '';
    if (existingRoom && this.roomOptions.includes(existingRoom)) {
      this.boxForm.patchValue({ room: existingRoom });
      this.isOtherRoomSelected = false;
    } else {
      this.boxForm.patchValue({ room: 'Other', roomOther: existingRoom });
      this.isOtherRoomSelected = true;
    }

    // Si tenemos una imagen del box, la mostramos
    if (this.box?.imageUrl) {
      // Asegurarse de que la URL es absoluta usando nuestro servicio
      this.selectedImageUrl = this.imageUrlService.getAbsoluteUrl(
        this.box.imageUrl
      );

      // Extraer el nombre del archivo de la URL
      const urlParts = this.box.imageUrl.split('/');
      this.selectedFileName = urlParts[urlParts.length - 1] || 'image';

      // Resolution is async (Spec 012) -- mirrors ItemModalComponent so the
      // preview also short-circuits dead blob: rows to null instead of a
      // broken <img>.
      this.imageUrlService
        .resolveImageSrc(this.box.imageUrl)
        .then((resolved) => {
          this.imagePreview = resolved;
        });
    }

    // Load the available checklists
    this.loadAvailableChecklists();

    // Inline "add item" mini-form for the items sub-step (Spec 009 Step 4),
    // reusing the same field set as item-modal.component.ts's itemForm.
    this.itemForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      quantity: [
        1,
        [Validators.required, Validators.min(1), Validators.max(9999)],
      ],
      isFragile: [false],
      expires: [false],
      expirationDate: [null],
    });
  }

  onExpiresChange() {
    const expiresValue = this.itemForm.get('expires')?.value;
    if (expiresValue) {
      if (!this.itemForm.get('expirationDate')?.value) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        this.itemForm.patchValue({
          expirationDate: tomorrow.toISOString(),
        });
      }
    } else {
      this.itemForm.patchValue({
        expirationDate: null,
      });
    }
  }

  loadAvailableChecklists() {
    this.isLoadingChecklists = true;
    this.localChecklistsService
      .getAllChecklists()
      .then((checklists) => {
        // Filter checklists that are not assigned to any box
        this.availableChecklists = checklists.filter(
          (checklist) => !checklist.boxId
        );
        this.isLoadingChecklists = false;
      })
      .catch(() => {
        this.isLoadingChecklists = false;
      });
  }

  /**
   * Mirrors `ItemModalComponent.takePicture()` -- same Camera plugin, same
   * `CameraSource.Prompt`/`Photos` split, same local-file-URI contract (see
   * docs/specs.md Spec 002 addendum: store a local file URI, never base64).
   */
  async takePicture() {
    try {
      // In web browser, use Photos (gallery) as default source
      const source = this.platform.is('capacitor')
        ? CameraSource.Prompt
        : CameraSource.Photos;

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
        this.selectedImageUrl = uri;
        this.selectedFileName = `photo-${new Date().getTime()}.jpg`;
        this.boxForm.patchValue({ image: uri });
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      // If camera fails, try with file input as fallback
      if (!this.platform.is('capacitor')) {
        this.fileInput.nativeElement.value = '';
        this.fileInput.nativeElement.click();
      } else {
        await this.toastService.presentErrorToast(
          'Error accessing camera/gallery'
        );
      }
    }
  }

  async onFileSelected(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    if (!inputElement.files?.length) {
      return;
    }

    const file = inputElement.files[0];

    if (!file.type.startsWith('image/')) {
      const alert = await this.alertController.create({
        header: 'Invalid file type',
        message: 'Please select an image file',
        buttons: ['OK'],
      });
      this.fileInput.nativeElement.value = '';
      this.selectedFileName = null;
      return await alert.present();
    }

    this.boxForm.patchValue({ image: file });
    this.selectedFileName = file.name;

    // Copy the picked file into durable on-device storage (Spec 012) and
    // store the resulting marker URI, never a `URL.createObjectURL(file)`
    // blob: URL — those only live for the current document lifetime and
    // leave a dead reference in SQLite after any reload.
    this.selectedImageUrl = await this.imageUrlService.persistPickedFile(file);
    this.imagePreview = await this.imageUrlService.resolveImageSrc(
      this.selectedImageUrl
    );
  }

  removeImage() {
    this.imagePreview = null;
    this.selectedImageUrl = '';
    this.selectedFileName = null;
    this.boxForm.patchValue({ image: '' });
  }

  onRoomChange() {
    this.isOtherRoomSelected = this.boxForm.value.room === 'Other';
  }

  changeFile() {
    this.fileInput.nativeElement.value = '';
    this.fileInput.nativeElement.click();
  }

  showErrorMessage(field: string) {
    const control = this.boxForm.get(field);
    if (control?.hasError('required')) {
      return 'This field is required';
    }
    if (control?.hasError('maxlength')) {
      return `This field has a maximum length of ${
        field === 'name' ? this.nameMaxLength : this.descriptionMaxLength
      }`;
    }
    return '';
  }

  cancel() {
    return this.modalController.dismiss(null, 'cancel');
  }

  // Variable para prevenir múltiples envíos
  private isSubmitting = false;

  confirm() {
    // Evitar múltiples envíos
    if (this.isSubmitting) {
      console.log('Form submission already in progress');
      return;
    }

    this.isSubmitting = true;

    // Creamos el objeto box a enviar
    const box: BoxReqDto = {
      name: this.boxForm.value.name,
      description: this.boxForm.value.description,
      image: '', // Valor por defecto, lo actualizaremos según el caso
      checklistId: this.boxForm.value.checklistId,
      room: this.isOtherRoomSelected
        ? this.boxForm.value.roomOther
        : this.boxForm.value.room,
    };

    // Manejar la imagen: `box.image` is a local file URI (object URL), not
    // base64 — per docs/specs.md Spec 002 addendum.
    const hasNewImage = !!this.boxForm.get('image')?.value;

    if (hasNewImage && this.selectedImageUrl) {
      box.image = this.selectedImageUrl;
    } else if (this.isEditMode && !hasNewImage) {
      // En modo edición sin nueva imagen, no enviamos el campo para que se
      // mantenga la imagen local actual del box.
      delete box.image;
    }

    if (this.isEditMode) {
      // Edit mode is unaffected by Spec 009 Step 4 — dismiss immediately as
      // before, via the existing boxSubject + BoxStateService.updateBox path.
      this.boxSubject.next(box);
      this.modalController.dismiss();
      return;
    }

    // Create mode (Spec 009 Step 4): create the box directly here (instead
    // of going through boxSubject/BoxStateService, which dismisses the modal
    // immediately on success) so the modal can stay open and transition into
    // the "add items" sub-step.
    this.boxService.createBox(box).subscribe({
      next: (newBox) => {
        this.isSubmitting = false;
        this.createdBox = newBox;
        this.onConfirmEvent.emit(newBox);
        this.step = 'items';
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Error creating box:', error);
        this.toastService.presentErrorToast('Error creating box');
      },
    });
  }

  get itemNameError() {
    const nameControl = this.itemForm.get('name');
    if (nameControl?.hasError('required') && nameControl?.touched) {
      return 'Item name is required';
    }
    if (nameControl?.hasError('maxlength')) {
      return 'Item name must be less than 100 characters';
    }
    return null;
  }

  async addItem() {
    if (!this.itemForm.valid || !this.createdBox || this.isAddingItem) {
      return;
    }

    this.isAddingItem = true;
    const formValue = this.itemForm.value;

    this.itemService
      .createItem(this.createdBox.id, {
        name: formValue.name,
        quantity: formValue.quantity,
        isFragile: formValue.isFragile,
        expires: formValue.expires,
        expirationDate: formValue.expires ? formValue.expirationDate : undefined,
      })
      .subscribe({
        next: (newItem) => {
          this.isAddingItem = false;
          this.addedItems = [newItem, ...this.addedItems];
          this.itemForm.reset({
            name: '',
            quantity: 1,
            isFragile: false,
            expires: false,
            expirationDate: null,
          });
        },
        error: (error) => {
          this.isAddingItem = false;
          console.error('Error adding item:', error);
          this.toastService.presentErrorToast('Error adding item');
        },
      });
  }

  done() {
    return this.modalController.dismiss(
      { box: this.createdBox, itemCount: this.addedItems.length },
      'confirm'
    );
  }
}
