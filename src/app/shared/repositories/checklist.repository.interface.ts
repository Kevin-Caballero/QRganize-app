import { InjectionToken } from '@angular/core';
import { LocalChecklist, LocalChecklistItem } from '../models/local-checklist';

/**
 * Storage-agnostic contract for local checklist persistence (see
 * docs/architecture.md mandatory layering and docs/specs.md Spec 005).
 * No SQLite-specific type appears here — only `LocalChecklist`/
 * `LocalChecklistItem` and primitives — so this interface can be implemented
 * by `ChecklistSqliteRepository` or by an in-memory fake for a later spec's
 * Feature Service tests, without either side depending on storage
 * technology.
 *
 * Single repository managing both checklists and their items (see Spec
 * 005's "Repository Interface decision") — a checklist and its items are not
 * independently useful, so this is not split into two interfaces.
 *
 * `checklistId` is excluded from `updateItem`'s changes — reassigning an
 * item to a different checklist is not supported through this method in
 * this spec, mirroring `boxId`'s exclusion from `ItemRepository#update`.
 */
/**
 * Every method takes the caller-resolved `firebaseUid` of the current user
 * (Spec 011, "Per-user local data scoping") — see `BoxRepository`'s
 * equivalent doc comment for the full rationale.
 *
 * `checklist_items` has no `firebase_uid` column of its own (see Spec 011's
 * "Checklist items: join vs. duplicate column"); item methods are scoped
 * transitively by joining/looking up the owning `checklists.firebase_uid` in
 * the SQLite implementation. Item methods still take `firebaseUid` here, in
 * the interface, so callers (and the in-memory fake) have one consistent
 * contract regardless of which table actually stores the column.
 */
export interface ChecklistRepository {
  createChecklist(
    checklist: LocalChecklist,
    firebaseUid: string
  ): Promise<LocalChecklist>;
  findChecklistById(
    id: string,
    firebaseUid: string
  ): Promise<LocalChecklist | null>;
  findAllChecklists(
    firebaseUid: string,
    options?: {
      includeArchived?: boolean;
      includeDeleted?: boolean;
    }
  ): Promise<LocalChecklist[]>;
  updateChecklist(
    id: string,
    changes: Partial<Omit<LocalChecklist, 'id' | 'createdAt'>>,
    firebaseUid: string
  ): Promise<LocalChecklist>;
  softDeleteChecklist(id: string, firebaseUid: string): Promise<void>;
  hardDeleteChecklist(id: string, firebaseUid: string): Promise<void>;

  createItem(
    item: Omit<LocalChecklistItem, 'sortOrder'> & { sortOrder?: number },
    firebaseUid: string
  ): Promise<LocalChecklistItem>;
  findItemsByChecklistId(
    checklistId: string,
    firebaseUid: string,
    options?: { includeDeleted?: boolean }
  ): Promise<LocalChecklistItem[]>;
  updateItem(
    id: string,
    changes: Partial<
      Omit<LocalChecklistItem, 'id' | 'checklistId' | 'createdAt'>
    >,
    firebaseUid: string
  ): Promise<LocalChecklistItem>;
  softDeleteItem(id: string, firebaseUid: string): Promise<void>;
  hardDeleteItem(id: string, firebaseUid: string): Promise<void>;
  reorderItems(
    checklistId: string,
    orderedItemIds: string[],
    firebaseUid: string
  ): Promise<void>;
}

/**
 * DI token Feature Services depend on instead of the concrete
 * `ChecklistSqliteRepository` class — see `BOX_REPOSITORY` for rationale.
 * Production wiring (`app.module.ts`) provides this token with
 * `ChecklistSqliteRepository`; tests provide it with
 * `ChecklistFakeRepository`.
 */
export const CHECKLIST_REPOSITORY = new InjectionToken<ChecklistRepository>(
  'CHECKLIST_REPOSITORY'
);
