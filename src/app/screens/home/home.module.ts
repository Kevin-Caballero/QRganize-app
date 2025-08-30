import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HomePage } from './home.page';
import { HomeRoutingModule } from './home-routing.module';
import { BoxListComponent } from './components/box-list/box-list.component';
import { BoxModalComponent } from './components/box-modal/box-modal.component';
import { HttpClientModule } from '@angular/common/http';
import { BoxDetailComponent } from './components/box-detail/box-detail.component';
import { QrModalComponent } from './components/qr-modal/qr-modal.component';
import { ItemModalComponent } from './components/item-modal/item-modal.component';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    HomeRoutingModule,
    ReactiveFormsModule,
    HttpClientModule,
  ],
  declarations: [
    HomePage,
    BoxListComponent,
    BoxModalComponent,
    BoxDetailComponent,
    QrModalComponent,
    ItemModalComponent,
  ],
})
export class HomeModule {}
