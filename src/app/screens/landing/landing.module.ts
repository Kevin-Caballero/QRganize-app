import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LandingComponent } from './landing.component';
import { IonicModule } from '@ionic/angular';
import { LandingRoutingModule } from './landing-routing.module';

@NgModule({
  declarations: [LandingComponent],
  imports: [CommonModule, IonicModule, LandingRoutingModule],
})
export class LandingModule {}
