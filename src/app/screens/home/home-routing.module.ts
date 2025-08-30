import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomePage } from './home.page';
import { BoxDetailComponent } from './components/box-detail/box-detail.component';

const routes: Routes = [
  {
    path: '',
    component: HomePage,
  },
  {
    path: 'box/:id',
    component: BoxDetailComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HomeRoutingModule {}
