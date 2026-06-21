import { Migration } from './migration.interface';

/**
 * Creates the `items` table backing the local-first `ItemSqliteRepository`
 * (see docs/specs.md Spec 004). Columns are snake_case; mapping to the
 * camelCase `LocalItem` model happens only in `item-sqlite.repository.ts`.
 *
 * `box_id` has a real foreign key to `boxes(id)` with `ON DELETE CASCADE` —
 * this only takes effect while `PRAGMA foreign_keys = ON` is active on the
 * connection (see the Spec 004 change to `sqlite.service.ts`).
 */
export const migration003Items: Migration = {
  version: 3,
  description: 'Create items table',
  async up(tx) {
    await tx.execute(
      `CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        box_id TEXT NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        quantity INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        image_uri TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );`
    );
    await tx.execute(
      'CREATE INDEX IF NOT EXISTS idx_items_box_id ON items (box_id);'
    );
    await tx.execute(
      'CREATE INDEX IF NOT EXISTS idx_items_deleted_at ON items (deleted_at);'
    );
    await tx.execute(
      'CREATE INDEX IF NOT EXISTS idx_items_status ON items (status);'
    );
  },
};
