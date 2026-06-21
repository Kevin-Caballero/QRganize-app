import { Injectable } from '@angular/core';
import { SqliteService } from '../../core/sqlite/sqlite.service';
import { ItemStatus, LocalItem } from '../models/local-item';
import { ItemRepository } from './item.repository.interface';

/**
 * Raw `items` row shape as stored by SQLite (snake_case columns). This type
 * is intentionally private to this file — mapping to/from `LocalItem`
 * happens only here, per docs/architecture.md (the SQLite Repository
 * Implementation is the only layer allowed to know the column names).
 */
interface ItemRow {
  id: string;
  box_id: string;
  name: string;
  description: string;
  category: string;
  quantity: number;
  status: string;
  image_uri: string;
  is_fragile: number | null;
  expires: number | null;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  firebase_uid: string | null;
}

function rowToLocalItem(row: ItemRow): LocalItem {
  const item: LocalItem = {
    id: row.id,
    boxId: row.box_id,
    name: row.name,
    description: row.description,
    category: row.category,
    quantity: row.quantity,
    status: row.status as ItemStatus,
    imageUri: row.image_uri,
    isFragile: !!row.is_fragile,
    expires: !!row.expires,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.expiration_date !== null && row.expiration_date !== undefined) {
    item.expirationDate = row.expiration_date;
  }
  if (row.deleted_at !== null && row.deleted_at !== undefined) {
    item.deletedAt = row.deleted_at;
  }
  return item;
}

function assertValidQuantity(quantity: number): void {
  if (quantity < 1) {
    throw new Error('Item quantity must be at least 1.');
  }
}

/**
 * `ItemRepository` implementation backed by the Spec 002 `SqliteService`.
 * Uses only `execute`/`query`/`transaction` — never the SQLite plugin or
 * connection directly (see docs/architecture.md).
 *
 * `boxId` is enforced by the real `box_id` foreign key on the `items` table
 * (see `003_items.ts`) — this repository does not duplicate that check; a
 * `create` against a non-existent `boxId` propagates the FK violation
 * thrown by SQLite, provided `PRAGMA foreign_keys = ON` is active on the
 * connection (see `SqliteService.initialize()`).
 */
@Injectable({
  providedIn: 'root',
})
export class ItemSqliteRepository implements ItemRepository {
  constructor(private readonly sqlite: SqliteService) {}

  async create(item: LocalItem, firebaseUid: string): Promise<LocalItem> {
    assertValidQuantity(item.quantity);

    const now = new Date().toISOString();
    const toInsert: LocalItem = {
      ...item,
      createdAt: now,
      updatedAt: now,
    };

    await this.sqlite.execute(
      `INSERT INTO items (
        id, box_id, name, description, category, quantity, status, image_uri, is_fragile, expires, expiration_date, created_at, updated_at, deleted_at, firebase_uid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        toInsert.id,
        toInsert.boxId,
        toInsert.name,
        toInsert.description,
        toInsert.category,
        toInsert.quantity,
        toInsert.status,
        toInsert.imageUri,
        toInsert.isFragile ? 1 : 0,
        toInsert.expires ? 1 : 0,
        toInsert.expirationDate ?? null,
        toInsert.createdAt,
        toInsert.updatedAt,
        toInsert.deletedAt ?? null,
        firebaseUid,
      ]
    );

    return toInsert;
  }

  async findById(id: string, firebaseUid: string): Promise<LocalItem | null> {
    const rows = await this.sqlite.query<ItemRow>(
      'SELECT * FROM items WHERE id = ? AND firebase_uid = ?;',
      [id, firebaseUid]
    );
    return rows.length > 0 ? rowToLocalItem(rows[0]) : null;
  }

  async findByBoxId(
    boxId: string,
    firebaseUid: string,
    options: { includeArchived?: boolean; includeDeleted?: boolean } = {}
  ): Promise<LocalItem[]> {
    const { includeArchived = false, includeDeleted = false } = options;

    const conditions: string[] = ['box_id = ?', 'firebase_uid = ?'];
    if (!includeDeleted) {
      conditions.push('deleted_at IS NULL');
    }
    if (!includeArchived) {
      conditions.push("status != 'archived'");
    }

    const rows = await this.sqlite.query<ItemRow>(
      `SELECT * FROM items WHERE ${conditions.join(' AND ')};`,
      [boxId, firebaseUid]
    );
    return rows.map(rowToLocalItem);
  }

  async findAll(
    firebaseUid: string,
    options: { includeArchived?: boolean; includeDeleted?: boolean } = {}
  ): Promise<LocalItem[]> {
    const { includeArchived = false, includeDeleted = false } = options;

    const conditions: string[] = ['firebase_uid = ?'];
    if (!includeDeleted) {
      conditions.push('deleted_at IS NULL');
    }
    if (!includeArchived) {
      conditions.push("status != 'archived'");
    }

    const rows = await this.sqlite.query<ItemRow>(
      `SELECT * FROM items WHERE ${conditions.join(' AND ')};`,
      [firebaseUid]
    );
    return rows.map(rowToLocalItem);
  }

  async update(
    id: string,
    changes: Partial<Omit<LocalItem, 'id' | 'boxId' | 'createdAt'>>,
    firebaseUid: string
  ): Promise<LocalItem> {
    const existing = await this.findById(id, firebaseUid);
    if (!existing) {
      throw new Error(`Item not found: ${id}`);
    }

    const updated: LocalItem = {
      ...existing,
      ...changes,
      id: existing.id,
      boxId: existing.boxId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    assertValidQuantity(updated.quantity);

    // `AND firebase_uid = ?` is deliberate defense-in-depth (Spec 011): see
    // `BoxSqliteRepository.update`'s equivalent comment.
    await this.sqlite.execute(
      `UPDATE items SET
        name = ?,
        description = ?,
        category = ?,
        quantity = ?,
        status = ?,
        image_uri = ?,
        is_fragile = ?,
        expires = ?,
        expiration_date = ?,
        updated_at = ?,
        deleted_at = ?
      WHERE id = ? AND firebase_uid = ?;`,
      [
        updated.name,
        updated.description,
        updated.category,
        updated.quantity,
        updated.status,
        updated.imageUri,
        updated.isFragile ? 1 : 0,
        updated.expires ? 1 : 0,
        updated.expirationDate ?? null,
        updated.updatedAt,
        updated.deletedAt ?? null,
        updated.id,
        firebaseUid,
      ]
    );

    return updated;
  }

  async softDelete(id: string, firebaseUid: string): Promise<void> {
    await this.sqlite.execute(
      'UPDATE items SET deleted_at = ? WHERE id = ? AND firebase_uid = ?;',
      [new Date().toISOString(), id, firebaseUid]
    );
  }

  async hardDelete(id: string, firebaseUid: string): Promise<void> {
    await this.sqlite.execute(
      'DELETE FROM items WHERE id = ? AND firebase_uid = ?;',
      [id, firebaseUid]
    );
  }
}
