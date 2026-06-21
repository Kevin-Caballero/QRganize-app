import { BehaviorSubject, Observable } from 'rxjs';
import { AuthUser } from '../models/auth-user';
import { AuthRepository } from './auth.repository.interface';

/**
 * In-memory fake `AuthRepository`, with no Firebase/Capacitor dependency.
 * Per docs/conventions.md ("Repository interfaces get a fake/in-memory
 * implementation for testing Feature Services"), this exists so
 * `AuthGateService`'s tests can depend on an `AuthRepository` without
 * touching the real plugin. Not used by any production code.
 */
export class AuthFakeRepository implements AuthRepository {
  private readonly authStateSubject = new BehaviorSubject<AuthUser | null>(
    null
  );

  readonly authState$: Observable<AuthUser | null> =
    this.authStateSubject.asObservable();

  private readonly users = new Map<string, { password: string; user: AuthUser }>();

  async getCurrentUser(): Promise<AuthUser | null> {
    return this.authStateSubject.value;
  }

  async signUpWithEmail(email: string, password: string): Promise<AuthUser> {
    if (this.users.has(email)) {
      const error: any = new Error('Email already in use');
      error.code = 'auth/email-already-in-use';
      throw error;
    }
    const user: AuthUser = {
      uid: `fake-${email}`,
      email,
      displayName: null,
      photoURL: null,
    };
    this.users.set(email, { password, user });
    this.authStateSubject.next(user);
    return user;
  }

  async signInWithEmail(email: string, password: string): Promise<AuthUser> {
    const record = this.users.get(email);
    if (!record || record.password !== password) {
      const error: any = new Error('Invalid credentials');
      error.code = 'auth/wrong-password';
      throw error;
    }
    this.authStateSubject.next(record.user);
    return record.user;
  }

  async signInWithGoogle(): Promise<AuthUser> {
    const user: AuthUser = {
      uid: 'fake-google-uid',
      email: 'fake.google.user@example.com',
      displayName: 'Fake Google User',
      photoURL: null,
    };
    this.authStateSubject.next(user);
    return user;
  }

  async sendPasswordResetEmail(): Promise<void> {
    // No-op for the fake — nothing to assert on in tests beyond the call
    // resolving without throwing.
  }

  async signOut(): Promise<void> {
    this.authStateSubject.next(null);
  }

  /** Test helper: clears all in-memory state between specs. */
  reset(): void {
    this.users.clear();
    this.authStateSubject.next(null);
  }
}
