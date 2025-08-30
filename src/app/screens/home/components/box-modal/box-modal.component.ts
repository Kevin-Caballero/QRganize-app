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
import { AlertController, ModalController } from '@ionic/angular';
import { Box } from '../../models/box.interface';
import { Subject } from 'rxjs';
import { BoxReqDto } from '../../models/box-req.dto';
import { ChecklistService } from 'src/app/shared/services/checklist.service';
import { Checklist } from 'src/app/shared/interfaces/checklist.interface';
import { environment } from 'src/environments/environment';
import { ImageUrlService } from 'src/app/shared/services/image-url.service';

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
  descriptionMaxLength = 255;
  nameMaxLength = 50;
  isEditMode = false;

  // Variables to handle checklists
  availableChecklists: Checklist[] = [];
  isLoadingChecklists = false;

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private formBuilder: FormBuilder,
    private checklistService: ChecklistService,
    private imageUrlService: ImageUrlService
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
    });

    // Si tenemos una imagen del box, la mostramos
    if (this.box?.imageUrl) {
      // Asegurarse de que la URL es absoluta usando nuestro servicio
      this.selectedImageUrl = this.imageUrlService.getAbsoluteUrl(
        this.box.imageUrl
      );

      // Extraer el nombre del archivo de la URL
      const urlParts = this.box.imageUrl.split('/');
      this.selectedFileName = urlParts[urlParts.length - 1] || 'image';
    }

    // Load the available checklists
    this.loadAvailableChecklists();
  }

  loadAvailableChecklists() {
    this.isLoadingChecklists = true;
    this.checklistService.getChecklists().subscribe({
      next: (checklists) => {
        // Filter checklists that are not assigned to any box
        this.availableChecklists = checklists.filter(
          (checklist) => !checklist.boxId
        );
        this.isLoadingChecklists = false;
      },
      error: () => {
        this.isLoadingChecklists = false;
      },
    });
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

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.selectedImageUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);
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
    };

    // Manejar la imagen
    const hasNewImage = !!this.boxForm.get('image')?.value;

    if (
      hasNewImage &&
      this.selectedImageUrl &&
      this.selectedImageUrl.includes('base64,')
    ) {
      // Si hay una nueva imagen, enviamos el base64
      const base64Index = this.selectedImageUrl.indexOf('base64,') + 7;
      box.image = this.selectedImageUrl.substring(base64Index);
    } else if (this.isEditMode && !hasNewImage) {
      // Si estamos en modo edición y no hay nueva imagen, eliminamos el campo
      // para que el backend mantenga la imagen actual
      delete box.image;
    }

    // Emitimos el box y cerramos el modal inmediatamente para evitar dobles envíos
    this.boxSubject.next(box);
    this.modalController.dismiss();
  }
}
