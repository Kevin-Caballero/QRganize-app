import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ChecklistsPageRoutingModule } from './checklists-routing.module';
import { SharedModule } from '../../shared/shared.module';

import { ChecklistsPage } from './checklists.page';
import { ChecklistModalComponent } from './components/checklist-modal/checklist-modal.component';
import { ChecklistItemsComponent } from './components/checklist-items/checklist-items.component';
import { ChecklistDetailPage } from './pages/checklist-detail/checklist-detail.page';
import { ImageModalModule } from '../../components/image-modal/image-modal.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    ChecklistsPageRoutingModule,
    SharedModule,
    ImageModalModule,
  ],
  declarations: [
    ChecklistsPage,
    ChecklistModalComponent,
    ChecklistItemsComponent,
    ChecklistDetailPage,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ChecklistsPageModule {}
