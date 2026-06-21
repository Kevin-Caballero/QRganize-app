import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthUser } from '../models/auth-user';

/**
 * Storage/provider-agnostic contract for the authentication identity gate
 * (Spec 010). No Firebase-specific type appears here — only `AuthUser` and
 * primitives — so this interface can be implemented by
 * `FirebaseAuthRepository` or by an in-memory fake for `AuthGateService`
 * tests, without either side depending on the auth provider/SDK directly.
 *
 * Per docs/architecture.md's mandatory layering, only `AuthGateService` may
 * depend on this interface; only `FirebaseAuthRepository` may import the
 * `@capacitor-firebase/authentication` plugin.
 *
 * Designed to stay extensible for a third provider later (e.g. Apple) —
 * adding one means adding a new `signInWith<Provider>()` method here and in
 * the implementation, without restructuring this contract's shape.
 */
export interface AuthRepository {
  /** Emits the current authenticated user, or `null` when signed out. */
  readonly authState$: Observable<AuthUser | null>;

  /** Resolves once the initial auth state has been determined at startup. */
  getCurrentUser(): Promise<AuthUser | null>;

  signUpWithEmail(email: string, password: string): Promise<AuthUser>;
  signInWithEmail(email: string, password: string): Promise<AuthUser>;
  signInWithGoogle(): Promise<AuthUser>;
  sendPasswordResetEmail(email: string): Promise<void>;
  signOut(): Promise<void>;
}

/**
 * DI token Feature Services depend on instead of the concrete
 * `FirebaseAuthRepository` class, so the layering rule in
 * docs/architecture.md (Feature Service → Repository Interface, never a
 * concrete implementation) is enforced by the injected type. Production
 * wiring (`app.module.ts`) provides this token with `FirebaseAuthRepository`;
 * tests provide it with an in-memory fake.
 */
export const AUTH_REPOSITORY = new InjectionToken<AuthRepository>(
  'AUTH_REPOSITORY'
);
