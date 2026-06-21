import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthUser } from '../models/auth-user';
import {
  AUTH_REPOSITORY,
  AuthRepository,
} from '../repositories/auth.repository.interface';

/**
 * Feature Service for the mandatory Firebase Authentication gate
 * (Spec 010). This is the ONLY thing pages/components are allowed to
 * inject for auth — never `AuthRepository`/`FirebaseAuthRepository`
 * directly, per docs/architecture.md's mandatory layering.
 *
 * Wraps `AuthRepository` 1:1 — no extra business logic beyond exposing a
 * stable `authState$`/`isAuthenticated()` surface for the route guard and
 * the login/signup/settings screens.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthGateService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepository
  ) {}

  /** Emits the current authenticated user, or `null` when signed out. */
  get authState$(): Observable<AuthUser | null> {
    return this.authRepository.authState$;
  }

  /** Resolves once the initial auth state has been determined at startup. */
  getCurrentUser(): Promise<AuthUser | null> {
    return this.authRepository.getCurrentUser();
  }

  async isAuthenticated(): Promise<boolean> {
    const user = await this.authRepository.getCurrentUser();
    return user !== null;
  }

  signUpWithEmail(email: string, password: string): Promise<AuthUser> {
    return this.authRepository.signUpWithEmail(email, password);
  }

  signInWithEmail(email: string, password: string): Promise<AuthUser> {
    return this.authRepository.signInWithEmail(email, password);
  }

  signInWithGoogle(): Promise<AuthUser> {
    return this.authRepository.signInWithGoogle();
  }

  sendPasswordResetEmail(email: string): Promise<void> {
    return this.authRepository.sendPasswordResetEmail(email);
  }

  signOut(): Promise<void> {
    return this.authRepository.signOut();
  }
}
