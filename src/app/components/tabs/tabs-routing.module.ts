import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadChildren: () =>
          import('../../screens/home/home.module').then((m) => m.HomeModule),
      },
      {
        path: 'checklist',
        loadChildren: () =>
          import('../../screens/checklists/checklists.module').then(
            (m) => m.ChecklistsPageModule
          ),
      },
      {
        path: 'search',
        loadChildren: () =>
          import('../../screens/search/search.module').then(
            (m) => m.SearchModule
          ),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('../../screens/settings/settings.module').then(
            (m) => m.SettingsPageModule
          ),
      },
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/login',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}
