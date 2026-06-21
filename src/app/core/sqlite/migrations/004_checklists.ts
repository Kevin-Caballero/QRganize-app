import { Migration } from './migration.interface';

/**
 * Creates the `checklists` and `checklist_items` tables backing the
 * local-first `ChecklistSqliteRepository` (see docs/specs.md Spec 005).
 * Columns are snake_case; mapping to the camelCase `LocalChecklist`/
 * `LocalChecklistItem` models happens only in `checklist-sqlite.repository.ts`.
 *
 * `checklist_id` has a real foreign key to `checklists(id)` with
 * `ON DELETE CASCADE` — this only takes effect while
 * `PRAGMA foreign_keys = ON` is active on the connection, already enabled by
 * Spec 004 in `sqlite.service.ts`.
 */
export const migration004Checklists: Migration = {
  version: 4,
  description: 'Create checklists and checklist_items tables',
  async up(tx) {
    await tx.execute(
      `CREATE TABLE IF NOT EXISTS checklists (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );`
    );
    await tx.execute(
      'CREATE INDEX IF NOT EXISTS idx_checklists_deleted_at ON checklists (deleted_at);'
    );
    await tx.execute(
      'CREATE INDEX IF NOT EXISTS idx_checklists_status ON checklists (status);'
    );

    await tx.execute(
      `CREATE TABLE IF NOT EXISTS checklist_items (
        id TEXT PRIMARY KEY,
        checklist_id TEXT NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        is_completed INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );`
    );
    await tx.execute(
      'CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items (checklist_id);'
    );
    await tx.execute(
      'CREATE INDEX IF NOT EXISTS idx_checklist_items_deleted_at ON checklist_items (deleted_at);'
    );
  },
};
