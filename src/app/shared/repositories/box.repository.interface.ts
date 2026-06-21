import { InjectionToken } from '@angular/core';
import { LocalBox } from '../models/local-box';

/**
 * Storage-agnostic contract for local box persistence (see
 * docs/architecture.md mandatory layering and docs/specs.md Spec 003).
 * No SQLite-specific type appears here — only `LocalBox` and primitives —
 * so this interface can be implemented by `BoxSqliteRepository` or by an
 * in-memory fake for Feature Service tests (Spec 004) without either side
 * depending on storage technology.
 */
/**
 * Every method takes the caller-resolved `firebaseUid` of the current user
 * (Spec 011, "Per-user local data scoping") and the SQLite implementation
 * filters/stamps `firebase_uid` accordingly. Repositories stay "dumb" about
 * auth — they accept a UID parameter and never reach into `AuthGateService`
 * or any auth concept directly; `LocalBoxesService` is responsible for
 * resolving "who is the current user" and passing it down.
 *
 * `findById` returns `null` (not a thrown error) for a row that exists but
 * belongs to a different user, consistent with how it already returns
 * `null` for a genuinely missing row — this avoids leaking "this id exists,
 * just not for you" information to a caller.
 *
 * `update`/`softDelete`/`hardDelete` filter by `firebase_uid` in their
 * `WHERE` clause in addition to `id`, as deliberate defense-in-depth: even
 * if a bug elsewhere passed the wrong `id` (e.g. guessed or leaked from
 * another user's session), the database itself refuses to let user A
 * mutate user B's row.
 */
export interface BoxRepository {
  create(box: LocalBox, firebaseUid: string): Promise<LocalBox>;
  findById(id: string, firebaseUid: string): Promise<LocalBox | null>;
  findAll(
    firebaseUid: string,
    options?: {
      includeArchived?: boolean;
      includeDeleted?: boolean;
    }
  ): Promise<LocalBox[]>;
  update(
    id: string,
    changes: Partial<Omit<LocalBox, 'id' | 'createdAt'>>,
    firebaseUid: string
  ): Promise<LocalBox>;
  softDelete(id: string, firebaseUid: string): Promise<void>; // sets deletedAt
  hardDelete(id: string, firebaseUid: string): Promise<void>; // removes the row — used by tests/cleanup, not by any UI in this spec
}

/**
 * DI token Feature Services depend on instead of the concrete
 * `BoxSqliteRepository` class, so the layering rule in
 * docs/architecture.md (Feature Service → Repository Interface, never a
 * concrete SQLite class) is enforced by the injected type, not just by
 * convention. Production wiring (`app.module.ts`) provides this token with
 * `BoxSqliteRepository`; tests provide it with `BoxFakeRepository`.
 */
export const BOX_REPOSITORY = new InjectionToken<BoxRepository>(
  'BOX_REPOSITORY'
);
