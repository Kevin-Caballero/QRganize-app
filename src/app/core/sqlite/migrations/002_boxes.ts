import { Migration } from './migration.interface';

/**
 * Creates the `boxes` table backing the local-first `BoxSqliteRepository`
 * (see docs/specs.md Spec 003). Columns are snake_case; mapping to the
 * camelCase `LocalBox` model happens only in `box-sqlite.repository.ts`.
 */
export const migration002Boxes: Migration = {
  version: 2,
  description: 'Create boxes table',
  async up(tx) {
    await tx.execute(
      `CREATE TABLE IF NOT EXISTS boxes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        room TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        qr_code TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );`
    );
    await tx.execute(
      'CREATE INDEX IF NOT EXISTS idx_boxes_deleted_at ON boxes (deleted_at);'
    );
    await tx.execute(
      'CREATE INDEX IF NOT EXISTS idx_boxes_status ON boxes (status);'
    );
  },
};
