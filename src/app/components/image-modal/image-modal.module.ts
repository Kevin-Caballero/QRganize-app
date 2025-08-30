import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ImageModalComponent } from './image-modal.component';

@NgModule({
  declarations: [ImageModalComponent],
  imports: [CommonModule, IonicModule],
  exports: [ImageModalComponent],
})
export class ImageModalModule {}
