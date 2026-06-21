/**
 * Minimal authenticated-user shape exposed by `AuthGateService`/`AuthRepository`
 * (Spec 010). Deliberately small — this is an identity gate, not a full user
 * profile model. Mirrors the subset of Firebase's `User` that the UI
 * actually needs (login screen header, settings screen account display).
 */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
