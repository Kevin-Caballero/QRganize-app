import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AuthService } from './services/auth.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { ToastService } from './services/toast.service';
import { MessageService } from './services/message.service';
import { ItemFormComponent } from './components/item-form/item-form.component';

@NgModule({
  declarations: [ItemFormComponent],
  imports: [CommonModule, FormsModule, IonicModule],
  providers: [AuthService, ErrorHandlerService, ToastService, MessageService],
  exports: [ItemFormComponent],
})
export class SharedModule {}
