import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  {
    // Per Spec 010, the entire app shell (all tabs — home/checklist/search/
    // settings) is gated behind a successful Firebase Authentication
    // sign-in. AuthGuard redirects unauthenticated users to /login.
    path: '',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./components/tabs/tabs.module').then((m) => m.TabsPageModule),
  },
  {
    // Repurposed for Firebase email/password sign-up (Spec 010) — not
    // behind AuthGuard, since an unauthenticated user must be able to
    // reach it.
    path: 'register',
    loadChildren: () =>
      import('./screens/register/register.module').then(
        (m) => m.RegisterModule
      ),
  },
  {
    // Repurposed for Firebase email/password + Google sign-in (Spec 010) —
    // not behind AuthGuard, since an unauthenticated user must be able to
    // reach it.
    path: 'login',
    loadChildren: () =>
      import('./screens/login/login.module').then((m) => m.LoginModule),
  },
  {
    path: 'landing',
    loadChildren: () =>
      import('./screens/landing/landing.module').then((m) => m.LandingModule),
  },
  {
    path: 'onboarding',
    loadChildren: () =>
      import('./screens/onboarding/onboarding.module').then(
        (m) => m.OnboardingModule
      ),
  },
  {
    path: 'settings',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./screens/settings/settings.module').then(
        (m) => m.SettingsPageModule
      ),
  },
];
@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
