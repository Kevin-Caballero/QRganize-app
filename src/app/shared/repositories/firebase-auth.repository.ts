import { Injectable } from '@angular/core';
import {
  FirebaseAuthentication,
  User as FirebaseUser,
} from '@capacitor-firebase/authentication';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthUser } from '../models/auth-user';
import { AuthRepository } from './auth.repository.interface';

/**
 * `AuthRepository` implementation backed by `@capacitor-firebase/authentication`
 * (Spec 010). This is the ONLY file in the app allowed to import from
 * `@capacitor-firebase/authentication`, per docs/architecture.md's mandatory
 * layering (mirrors the SQLite-only-in-repository rule from Spec 002/003/004,
 * applied here to the new auth dependency).
 *
 * Chosen over extending the existing dormant `@angular/fire` scaffold
 * because `@capacitor-firebase/authentication` wraps the native Firebase
 * Auth SDKs on iOS/Android, giving proper native Google sign-in instead of a
 * web-only OAuth popup — required by Spec 010's acceptance criteria. The
 * existing `environment.firebaseConfig`-shaped keys are reused as-is (see
 * `app.module.ts`'s `initializeApp` call) rather than inventing a new config
 * shape.
 */
@Injectable()
export class FirebaseAuthRepository implements AuthRepository {
  private readonly authStateSubject = new BehaviorSubject<AuthUser | null>(
    null
  );

  readonly authState$: Observable<AuthUser | null> =
    this.authStateSubject.asObservable();

  constructor() {
    FirebaseAuthentication.addListener('authStateChange', (change) => {
      this.authStateSubject.next(this.toAuthUser(change.user));
    });

    // Seed the subject with whatever session the plugin already restored
    // (native persistence), so `authState$` reflects reality before the
    // first `authStateChange` event fires.
    void this.getCurrentUser();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const { user } = await FirebaseAuthentication.getCurrentUser();
    const authUser = this.toAuthUser(user);
    this.authStateSubject.next(authUser);
    return authUser;
  }

  async signUpWithEmail(email: string, password: string): Promise<AuthUser> {
    const result = await FirebaseAuthentication.createUserWithEmailAndPassword(
      { email, password }
    );
    const authUser = this.toAuthUser(result.user);
    this.authStateSubject.next(authUser);
    if (!authUser) {
      throw new Error('Sign-up did not return a user.');
    }
    return authUser;
  }

  async signInWithEmail(email: string, password: string): Promise<AuthUser> {
    const result = await FirebaseAuthentication.signInWithEmailAndPassword({
      email,
      password,
    });
    const authUser = this.toAuthUser(result.user);
    this.authStateSubject.next(authUser);
    if (!authUser) {
      throw new Error('Sign-in did not return a user.');
    }
    return authUser;
  }

  async signInWithGoogle(): Promise<AuthUser> {
    const result = await FirebaseAuthentication.signInWithGoogle();
    const authUser = this.toAuthUser(result.user);
    this.authStateSubject.next(authUser);
    if (!authUser) {
      throw new Error('Google sign-in did not return a user.');
    }
    return authUser;
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    await FirebaseAuthentication.sendPasswordResetEmail({ email });
  }

  async signOut(): Promise<void> {
    await FirebaseAuthentication.signOut();
    this.authStateSubject.next(null);
  }

  private toAuthUser(user: FirebaseUser | null): AuthUser | null {
    if (!user) {
      return null;
    }
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoUrl,
    };
  }
}
