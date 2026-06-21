import { Injectable } from '@angular/core';
import { SqliteService } from '../../core/sqlite/sqlite.service';
import {
  ChecklistStatus,
  LocalChecklist,
  LocalChecklistItem,
} from '../models/local-checklist';
import { ChecklistRepository } from './checklist.repository.interface';

/**
 * Raw `checklists` row shape as stored by SQLite (snake_case columns). This
 * type is intentionally private to this file — mapping to/from
 * `LocalChecklist` happens only here, per docs/architecture.md (the SQLite
 * Repository Implementation is the only layer allowed to know the column
 * names).
 */
interface ChecklistRow {
  id: string;
  title: string;
  description: string;
  status: string;
  box_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  firebase_uid: string | null;
}

interface ChecklistItemRow {
  id: string;
  checklist_id: string;
  title: string;
  notes: string;
  is_completed: number;
  sort_order: number;
  quantity: number | null;
  is_fragile: number | null;
  expires: number | null;
  expiration_date: string | null;
  image_uri: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function rowToLocalChecklist(row: ChecklistRow): LocalChecklist {
  const checklist: LocalChecklist = {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as ChecklistStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.box_id !== null && row.box_id !== undefined) {
    checklist.boxId = row.box_id;
  }
  if (row.deleted_at !== null && row.deleted_at !== undefined) {
    checklist.deletedAt = row.deleted_at;
  }
  return checklist;
}

function rowToLocalChecklistItem(row: ChecklistItemRow): LocalChecklistItem {
  const item: LocalChecklistItem = {
    id: row.id,
    checklistId: row.checklist_id,
    title: row.title,
    notes: row.notes,
    isCompleted: row.is_completed === 1,
    sortOrder: row.sort_order,
    quantity: row.quantity ?? 1,
    isFragile: !!row.is_fragile,
    expires: !!row.expires,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.expiration_date !== null && row.expiration_date !== undefined) {
    item.expirationDate = row.expiration_date;
  }
  if (row.image_uri !== null && row.image_uri !== undefined) {
    item.imageUri = row.image_uri;
  }
  if (row.deleted_at !== null && row.deleted_at !== undefined) {
    item.deletedAt = row.deleted_at;
  }
  return item;
}

function assertNonEmptyTitle(title: string): void {
  if (!title || title.trim().length === 0) {
    throw new Error('Title must not be empty.');
  }
}

/**
 * `ChecklistRepository` implementation backed by the Spec 002 `SqliteService`.
 * Uses only `execute`/`query`/`transaction` — never the SQLite plugin or
 * connection directly (see docs/architecture.md).
 *
 * `checklistId` is enforced by the real `checklist_id` foreign key on the
 * `checklist_items` table (see `004_checklists.ts`) — this repository does
 * not duplicate that check; a `createItem` against a non-existent
 * `checklistId` propagates the FK violation thrown by SQLite, provided
 * `PRAGMA foreign_keys = ON` is active on the connection (already enabled
 * in `SqliteService.initialize()` since Spec 004).
 *
 * Per Spec 011 ("Per-user local data scoping"), `checklists` has its own
 * `firebase_uid` column (migration 009), but `checklist_items` does not —
 * every item method here scopes transitively via a `JOIN`/lookup against
 * the owning `checklists.firebase_uid` instead. This was chosen over
 * duplicating the column onto `checklist_items` because every existing
 * item query pattern in this file already operates either via a known
 * `checklistId` (`findItemsByChecklistId`, `createItem`, `reorderItems`) or
 * a single item id whose owning checklist can be looked up first
 * (`findItemById`/`updateItem`/`softDeleteItem`/`hardDeleteItem`) — a join
 * or two-step lookup fits these patterns cleanly without a second migration.
 */
@Injectable({
  providedIn: 'root',
})
export class ChecklistSqliteRepository implements ChecklistRepository {
  constructor(private readonly sqlite: SqliteService) {}

  async createChecklist(
    checklist: LocalChecklist,
    firebaseUid: string
  ): Promise<LocalChecklist> {
    assertNonEmptyTitle(checklist.title);

    const now = new Date().toISOString();
    const toInsert: LocalChecklist = {
      ...checklist,
      createdAt: now,
      updatedAt: now,
    };

    await this.sqlite.execute(
      `INSERT INTO checklists (
        id, title, description, status, box_id, created_at, updated_at, deleted_at, firebase_uid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        toInsert.id,
        toInsert.title,
        toInsert.description,
        toInsert.status,
        toInsert.boxId ?? null,
        toInsert.createdAt,
        toInsert.updatedAt,
        toInsert.deletedAt ?? null,
        firebaseUid,
      ]
    );

    return toInsert;
  }

  async findChecklistById(
    id: string,
    firebaseUid: string
  ): Promise<LocalChecklist | null> {
    const rows = await this.sqlite.query<ChecklistRow>(
      'SELECT * FROM checklists WHERE id = ? AND firebase_uid = ?;',
      [id, firebaseUid]
    );
    return rows.length > 0 ? rowToLocalChecklist(rows[0]) : null;
  }

  async findAllChecklists(
    firebaseUid: string,
    options: { includeArchived?: boolean; includeDeleted?: boolean } = {}
  ): Promise<LocalChecklist[]> {
    const { includeArchived = false, includeDeleted = false } = options;

    const conditions: string[] = ['firebase_uid = ?'];
    if (!includeDeleted) {
      conditions.push('deleted_at IS NULL');
    }
    if (!includeArchived) {
      conditions.push("status != 'archived'");
    }

    const rows = await this.sqlite.query<ChecklistRow>(
      `SELECT * FROM checklists WHERE ${conditions.join(' AND ')};`,
      [firebaseUid]
    );
    return rows.map(rowToLocalChecklist);
  }

  async updateChecklist(
    id: string,
    changes: Partial<Omit<LocalChecklist, 'id' | 'createdAt'>>,
    firebaseUid: string
  ): Promise<LocalChecklist> {
    const existing = await this.findChecklistById(id, firebaseUid);
    if (!existing) {
      throw new Error(`Checklist not found: ${id}`);
    }

    const updated: LocalChecklist = {
      ...existing,
      ...changes,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    assertNonEmptyTitle(updated.title);

    // `AND firebase_uid = ?` is deliberate defense-in-depth (Spec 011): see
    // `BoxSqliteRepository.update`'s equivalent comment.
    await this.sqlite.execute(
      `UPDATE checklists SET
        title = ?,
        description = ?,
        status = ?,
        box_id = ?,
        updated_at = ?,
        deleted_at = ?
      WHERE id = ? AND firebase_uid = ?;`,
      [
        updated.title,
        updated.description,
        updated.status,
        updated.boxId ?? null,
        updated.updatedAt,
        updated.deletedAt ?? null,
        updated.id,
        firebaseUid,
      ]
    );

    return updated;
  }

  async softDeleteChecklist(id: string, firebaseUid: string): Promise<void> {
    await this.sqlite.execute(
      'UPDATE checklists SET deleted_at = ? WHERE id = ? AND firebase_uid = ?;',
      [new Date().toISOString(), id, firebaseUid]
    );
  }

  async hardDeleteChecklist(id: string, firebaseUid: string): Promise<void> {
    await this.sqlite.execute(
      'DELETE FROM checklists WHERE id = ? AND firebase_uid = ?;',
      [id, firebaseUid]
    );
  }

  async createItem(
    item: Omit<LocalChecklistItem, 'sortOrder'> & { sortOrder?: number },
    firebaseUid: string
  ): Promise<LocalChecklistItem> {
    assertNonEmptyTitle(item.title);

    // Checking the owning checklist belongs to this user before inserting
    // is the transitive-scoping equivalent of the `AND firebase_uid = ?`
    // filter used on tables that have their own column (Spec 011) — it
    // prevents creating an item under a checklist id that exists but
    // belongs to a different user.
    const owningChecklist = await this.findChecklistById(
      item.checklistId,
      firebaseUid
    );
    if (!owningChecklist) {
      throw new Error(`Checklist not found: ${item.checklistId}`);
    }

    const now = new Date().toISOString();
    const sortOrder =
      item.sortOrder !== undefined
        ? item.sortOrder
        : await this.nextSortOrder(item.checklistId, firebaseUid);

    const toInsert: LocalChecklistItem = {
      id: item.id,
      checklistId: item.checklistId,
      title: item.title,
      notes: item.notes,
      isCompleted: item.isCompleted,
      sortOrder,
      quantity: item.quantity ?? 1,
      isFragile: item.isFragile ?? false,
      expires: item.expires ?? false,
      createdAt: now,
      updatedAt: now,
    };
    if (item.expirationDate !== undefined) {
      toInsert.expirationDate = item.expirationDate;
    }
    if (item.imageUri !== undefined) {
      toInsert.imageUri = item.imageUri;
    }
    if (item.deletedAt !== undefined) {
      toInsert.deletedAt = item.deletedAt;
    }

    await this.sqlite.execute(
      `INSERT INTO checklist_items (
        id, checklist_id, title, notes, is_completed, sort_order, quantity, is_fragile, expires, expiration_date, image_uri, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        toInsert.id,
        toInsert.checklistId,
        toInsert.title,
        toInsert.notes,
        toInsert.isCompleted ? 1 : 0,
        toInsert.sortOrder,
        toInsert.quantity,
        toInsert.isFragile ? 1 : 0,
        toInsert.expires ? 1 : 0,
        toInsert.expirationDate ?? null,
        toInsert.imageUri ?? null,
        toInsert.createdAt,
        toInsert.updatedAt,
        toInsert.deletedAt ?? null,
      ]
    );

    return toInsert;
  }

  async findItemsByChecklistId(
    checklistId: string,
    firebaseUid: string,
    options: { includeDeleted?: boolean } = {}
  ): Promise<LocalChecklistItem[]> {
    const { includeDeleted = false } = options;

    // Transitive scoping (Spec 011): joins to `checklists` rather than a
    // `checklist_items.firebase_uid` column, since `checklist_items` has
    // none — see this file's class-level doc comment.
    const conditions: string[] = [
      'ci.checklist_id = ?',
      'c.firebase_uid = ?',
    ];
    if (!includeDeleted) {
      conditions.push('ci.deleted_at IS NULL');
    }

    const rows = await this.sqlite.query<ChecklistItemRow>(
      `SELECT ci.* FROM checklist_items ci
       JOIN checklists c ON c.id = ci.checklist_id
       WHERE ${conditions.join(' AND ')};`,
      [checklistId, firebaseUid]
    );
    return rows.map(rowToLocalChecklistItem);
  }

  async updateItem(
    id: string,
    changes: Partial<
      Omit<LocalChecklistItem, 'id' | 'checklistId' | 'createdAt'>
    >,
    firebaseUid: string
  ): Promise<LocalChecklistItem> {
    const existing = await this.findItemById(id, firebaseUid);
    if (!existing) {
      throw new Error(`Checklist item not found: ${id}`);
    }

    const updated: LocalChecklistItem = {
      ...existing,
      ...changes,
      id: existing.id,
      checklistId: existing.checklistId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    assertNonEmptyTitle(updated.title);

    // Transitive scoping (Spec 011): `UPDATE`/`DELETE` cannot `JOIN` in
    // SQLite, so the defense-in-depth filter here uses a subquery against
    // `checklists.firebase_uid` instead — the same security property as the
    // `AND firebase_uid = ?` filter used on tables that have their own
    // column, just expressed as a subquery because `checklist_items` has no
    // such column (see this file's class-level doc comment).
    await this.sqlite.execute(
      `UPDATE checklist_items SET
        title = ?,
        notes = ?,
        is_completed = ?,
        sort_order = ?,
        quantity = ?,
        is_fragile = ?,
        expires = ?,
        expiration_date = ?,
        image_uri = ?,
        updated_at = ?,
        deleted_at = ?
      WHERE id = ? AND checklist_id IN (
        SELECT id FROM checklists WHERE firebase_uid = ?
      );`,
      [
        updated.title,
        updated.notes,
        updated.isCompleted ? 1 : 0,
        updated.sortOrder,
        updated.quantity ?? 1,
        updated.isFragile ? 1 : 0,
        updated.expires ? 1 : 0,
        updated.expirationDate ?? null,
        updated.imageUri ?? null,
        updated.updatedAt,
        updated.deletedAt ?? null,
        updated.id,
        firebaseUid,
      ]
    );

    return updated;
  }

  async softDeleteItem(id: string, firebaseUid: string): Promise<void> {
    await this.sqlite.execute(
      `UPDATE checklist_items SET deleted_at = ? WHERE id = ? AND checklist_id IN (
        SELECT id FROM checklists WHERE firebase_uid = ?
      );`,
      [new Date().toISOString(), id, firebaseUid]
    );
  }

  async hardDeleteItem(id: string, firebaseUid: string): Promise<void> {
    await this.sqlite.execute(
      `DELETE FROM checklist_items WHERE id = ? AND checklist_id IN (
        SELECT id FROM checklists WHERE firebase_uid = ?
      );`,
      [id, firebaseUid]
    );
  }

  async reorderItems(
    checklistId: string,
    orderedItemIds: string[],
    firebaseUid: string
  ): Promise<void> {
    const existingItems = await this.findItemsByChecklistId(
      checklistId,
      firebaseUid,
      { includeDeleted: true }
    );
    const existingIds = new Set(existingItems.map((item) => item.id));

    for (const id of orderedItemIds) {
      if (!existingIds.has(id)) {
        throw new Error(
          `Checklist item ${id} does not belong to checklist ${checklistId}.`
        );
      }
    }

    await this.sqlite.transaction(async (tx) => {
      for (let index = 0; index < orderedItemIds.length; index++) {
        await tx.execute(
          'UPDATE checklist_items SET sort_order = ?, updated_at = ? WHERE id = ?;',
          [index, new Date().toISOString(), orderedItemIds[index]]
        );
      }
    });
  }

  private async findItemById(
    id: string,
    firebaseUid: string
  ): Promise<LocalChecklistItem | null> {
    // Transitive scoping (Spec 011): joins to `checklists` rather than a
    // `checklist_items.firebase_uid` column — see this file's class-level
    // doc comment.
    const rows = await this.sqlite.query<ChecklistItemRow>(
      `SELECT ci.* FROM checklist_items ci
       JOIN checklists c ON c.id = ci.checklist_id
       WHERE ci.id = ? AND c.firebase_uid = ?;`,
      [id, firebaseUid]
    );
    return rows.length > 0 ? rowToLocalChecklistItem(rows[0]) : null;
  }

  private async nextSortOrder(
    checklistId: string,
    firebaseUid: string
  ): Promise<number> {
    const items = await this.findItemsByChecklistId(
      checklistId,
      firebaseUid,
      { includeDeleted: true }
    );
    if (items.length === 0) {
      return 0;
    }
    return Math.max(...items.map((item) => item.sortOrder)) + 1;
  }
}
