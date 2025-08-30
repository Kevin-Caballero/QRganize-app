import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ChecklistsPage } from './checklists.page';
import { ChecklistDetailPage } from './pages/checklist-detail/checklist-detail.page';

const routes: Routes = [
  {
    path: '',
    component: ChecklistsPage,
  },
  {
    path: ':id',
    component: ChecklistDetailPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ChecklistsPageRoutingModule {}
