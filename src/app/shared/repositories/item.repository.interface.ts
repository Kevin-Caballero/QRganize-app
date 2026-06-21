import { InjectionToken } from '@angular/core';
import { LocalItem } from '../models/local-item';

/**
 * Storage-agnostic contract for local item persistence (see
 * docs/architecture.md mandatory layering and docs/specs.md Spec 004).
 * No SQLite-specific type appears here — only `LocalItem` and primitives —
 * so this interface can be implemented by `ItemSqliteRepository` or by an
 * in-memory fake for a later spec's Feature Service tests, without either
 * side depending on storage technology.
 *
 * `boxId` is required on `create` (an item must belong to a box) but is
 * excluded from `update`'s changes — reassigning an item to a different box
 * is not supported through this method in this spec.
 */
/**
 * Every method takes the caller-resolved `firebaseUid` of the current user
 * (Spec 011, "Per-user local data scoping") — see `BoxRepository`'s
 * equivalent doc comment for the full rationale (dumb repositories,
 * `findById` returns `null` rather than throwing for another user's row,
 * `update`/`softDelete`/`hardDelete` filter by UID as defense-in-depth).
 */
export interface ItemRepository {
  create(item: LocalItem, firebaseUid: string): Promise<LocalItem>;
  findById(id: string, firebaseUid: string): Promise<LocalItem | null>;
  findByBoxId(
    boxId: string,
    firebaseUid: string,
    options?: { includeArchived?: boolean; includeDeleted?: boolean }
  ): Promise<LocalItem[]>;
  findAll(
    firebaseUid: string,
    options?: {
      includeArchived?: boolean;
      includeDeleted?: boolean;
    }
  ): Promise<LocalItem[]>;
  update(
    id: string,
    changes: Partial<Omit<LocalItem, 'id' | 'boxId' | 'createdAt'>>,
    firebaseUid: string
  ): Promise<LocalItem>;
  softDelete(id: string, firebaseUid: string): Promise<void>; // sets deletedAt
  hardDelete(id: string, firebaseUid: string): Promise<void>; // removes the row — used by tests/cleanup, not by any UI in this spec
}

/**
 * DI token Feature Services depend on instead of the concrete
 * `ItemSqliteRepository` class — see `BOX_REPOSITORY` for rationale.
 * Production wiring (`app.module.ts`) provides this token with
 * `ItemSqliteRepository`; tests provide it with `ItemFakeRepository`.
 */
export const ITEM_REPOSITORY = new InjectionToken<ItemRepository>(
  'ITEM_REPOSITORY'
);
