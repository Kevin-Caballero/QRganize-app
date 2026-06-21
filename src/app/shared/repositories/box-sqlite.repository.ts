import { Injectable } from '@angular/core';
import { SqliteService } from '../../core/sqlite/sqlite.service';
import { BoxStatus, LocalBox } from '../models/local-box';
import { BoxRepository } from './box.repository.interface';

/**
 * Raw `boxes` row shape as stored by SQLite (snake_case columns). This type
 * is intentionally private to this file — mapping to/from `LocalBox` happens
 * only here, per docs/architecture.md (the SQLite Repository Implementation
 * is the only layer allowed to know the column names).
 */
interface BoxRow {
  id: string;
  name: string;
  description: string;
  room: string;
  status: string;
  packing_status: string;
  qr_code: string;
  image_uri: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  firebase_uid: string | null;
}

function rowToLocalBox(row: BoxRow): LocalBox {
  const box: LocalBox = {
    id: row.id,
    name: row.name,
    description: row.description,
    room: row.room,
    status: row.status as BoxStatus,
    packingStatus: row.packing_status as LocalBox['packingStatus'],
    qrCode: row.qr_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.image_uri !== null && row.image_uri !== undefined && row.image_uri !== '') {
    box.imageUri = row.image_uri;
  }
  if (row.deleted_at !== null && row.deleted_at !== undefined) {
    box.deletedAt = row.deleted_at;
  }
  return box;
}

/**
 * `BoxRepository` implementation backed by the Spec 002 `SqliteService`.
 * Uses only `execute`/`query`/`transaction` — never the SQLite plugin or
 * connection directly (see docs/architecture.md).
 */
@Injectable({
  providedIn: 'root',
})
export class BoxSqliteRepository implements BoxRepository {
  constructor(private readonly sqlite: SqliteService) {}

  async create(box: LocalBox, firebaseUid: string): Promise<LocalBox> {
    const now = new Date().toISOString();
    const toInsert: LocalBox = {
      ...box,
      createdAt: now,
      updatedAt: now,
    };

    await this.sqlite.execute(
      `INSERT INTO boxes (
        id, name, description, room, status, packing_status, qr_code, image_uri, created_at, updated_at, deleted_at, firebase_uid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        toInsert.id,
        toInsert.name,
        toInsert.description,
        toInsert.room,
        toInsert.status,
        toInsert.packingStatus,
        toInsert.qrCode,
        toInsert.imageUri ?? '',
        toInsert.createdAt,
        toInsert.updatedAt,
        toInsert.deletedAt ?? null,
        firebaseUid,
      ]
    );

    return toInsert;
  }

  async findById(id: string, firebaseUid: string): Promise<LocalBox | null> {
    const rows = await this.sqlite.query<BoxRow>(
      'SELECT * FROM boxes WHERE id = ? AND firebase_uid = ?;',
      [id, firebaseUid]
    );
    return rows.length > 0 ? rowToLocalBox(rows[0]) : null;
  }

  async findAll(
    firebaseUid: string,
    options: { includeArchived?: boolean; includeDeleted?: boolean } = {}
  ): Promise<LocalBox[]> {
    const { includeArchived = false, includeDeleted = false } = options;

    const conditions: string[] = ['firebase_uid = ?'];
    if (!includeDeleted) {
      conditions.push('deleted_at IS NULL');
    }
    if (!includeArchived) {
      conditions.push("status != 'archived'");
    }

    const rows = await this.sqlite.query<BoxRow>(
      `SELECT * FROM boxes WHERE ${conditions.join(' AND ')};`,
      [firebaseUid]
    );
    return rows.map(rowToLocalBox);
  }

  async update(
    id: string,
    changes: Partial<Omit<LocalBox, 'id' | 'createdAt'>>,
    firebaseUid: string
  ): Promise<LocalBox> {
    const existing = await this.findById(id, firebaseUid);
    if (!existing) {
      throw new Error(`Box not found: ${id}`);
    }

    const updated: LocalBox = {
      ...existing,
      ...changes,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    // `AND firebase_uid = ?` here is deliberate defense-in-depth (Spec 011),
    // not just query convenience: even if a future bug resolved the wrong
    // id, the database itself refuses to let one user mutate another
    // user's row.
    await this.sqlite.execute(
      `UPDATE boxes SET
        name = ?,
        description = ?,
        room = ?,
        status = ?,
        packing_status = ?,
        qr_code = ?,
        image_uri = ?,
        updated_at = ?,
        deleted_at = ?
      WHERE id = ? AND firebase_uid = ?;`,
      [
        updated.name,
        updated.description,
        updated.room,
        updated.status,
        updated.packingStatus,
        updated.qrCode,
        updated.imageUri ?? '',
        updated.updatedAt,
        updated.deletedAt ?? null,
        updated.id,
        firebaseUid,
      ]
    );

    return updated;
  }

  async softDelete(id: string, firebaseUid: string): Promise<void> {
    // `AND firebase_uid = ?` — same defense-in-depth rationale as `update`.
    await this.sqlite.execute(
      'UPDATE boxes SET deleted_at = ? WHERE id = ? AND firebase_uid = ?;',
      [new Date().toISOString(), id, firebaseUid]
    );
  }

  async hardDelete(id: string, firebaseUid: string): Promise<void> {
    await this.sqlite.execute(
      'DELETE FROM boxes WHERE id = ? AND firebase_uid = ?;',
      [id, firebaseUid]
    );
  }
}
