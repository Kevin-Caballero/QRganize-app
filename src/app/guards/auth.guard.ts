import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthGateService } from '../shared/services/auth-gate.service';

/**
 * Gates `/tabs/*` (and any other guarded route) behind a successful
 * Firebase Authentication sign-in, per Spec 010's mandatory auth gate.
 * Unauthenticated users are redirected to `/login` instead of reaching the
 * app shell.
 *
 * Only depends on `AuthGateService` (the Feature Service), never the
 * `AuthRepository`/`FirebaseAuthRepository` directly, per
 * docs/architecture.md's mandatory layering.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authGateService: AuthGateService,
    private readonly router: Router
  ) {}

  async canActivate(): Promise<boolean | UrlTree> {
    const isAuthenticated = await this.authGateService.isAuthenticated();
    if (isAuthenticated) {
      return true;
    }
    return this.router.createUrlTree(['/login']);
  }
}
