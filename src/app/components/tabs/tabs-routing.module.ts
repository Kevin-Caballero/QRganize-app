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
    // This fires whenever an *authenticated* user (AuthGuard already
    // passed on the outer `path: ''` in app-routing.module.ts) ends up
    // navigating to the bare root path -- e.g. when Android restores the
    // app's WebView after backgrounding/memory reclaim and the router's
    // initial navigation briefly resolves to '' before
    // AppComponent.initializeApp() finishes and navigates explicitly.
    // It previously redirected to '/onboarding', which meant ANY such
    // event sent already-onboarded users back to onboarding regardless of
    // `onboardingComplete` -- the actual first-run-vs-returning-user
    // decision belongs solely to AppStartupRouteService at real app
    // startup, not to this catch-all. Redirecting into the app shell
    // instead is always safe here.
    path: '',
    redirectTo: '/tabs/home',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}
