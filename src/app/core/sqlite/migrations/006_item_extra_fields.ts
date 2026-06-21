import { Migration } from './migration.interface';

/**
 * Adds `is_fragile`, `expires`, `expiration_date` to `items`, backing
 * `LocalItem.isFragile`/`expires`/`expirationDate` (see docs/specs.md
 * Spec 002's addendum: "Spec 003 home-screen wiring" decided the home UI
 * needs these fields, which existed on the original backend `Item` entity
 * but were dropped from `003_items.ts`'s initial local schema).
 */
export const migration006ItemExtraFields: Migration = {
  version: 6,
  description: 'Add is_fragile, expires, expiration_date columns to items',
  async up(tx) {
    const columns = await tx.query<{ name: string }>(
      "PRAGMA table_info(items);"
    );
    const names = new Set(columns.map((column) => column.name));

    if (!names.has('is_fragile')) {
      await tx.execute(
        'ALTER TABLE items ADD COLUMN is_fragile INTEGER NOT NULL DEFAULT 0;'
      );
    }
    if (!names.has('expires')) {
      await tx.execute(
        'ALTER TABLE items ADD COLUMN expires INTEGER NOT NULL DEFAULT 0;'
      );
    }
    if (!names.has('expiration_date')) {
      await tx.execute('ALTER TABLE items ADD COLUMN expiration_date TEXT;');
    }
  },
};
