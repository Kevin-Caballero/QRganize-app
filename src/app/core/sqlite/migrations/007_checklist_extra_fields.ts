import { Migration } from './migration.interface';

/**
 * Adds `box_id` to `checklists` and `quantity`, `is_fragile`, `expires`,
 * `expiration_date`, `image_uri` to `checklist_items` (see docs/specs.md
 * Spec 002's "Addendum 2": Spec 002's original `checklists`/`checklist_items`
 * schema already specified these columns, but `004_checklists.ts`'s initial
 * local schema dropped them. This migration restores them rather than
 * leaving the corresponding UI permanently degraded).
 */
export const migration007ChecklistExtraFields: Migration = {
  version: 7,
  description:
    'Add box_id to checklists; quantity, is_fragile, expires, expiration_date, image_uri to checklist_items',
  async up(tx) {
    const checklistColumns = await tx.query<{ name: string }>(
      'PRAGMA table_info(checklists);'
    );
    const checklistColumnNames = new Set(
      checklistColumns.map((column) => column.name)
    );

    if (!checklistColumnNames.has('box_id')) {
      await tx.execute(
        'ALTER TABLE checklists ADD COLUMN box_id TEXT REFERENCES boxes(id);'
      );
    }

    const itemColumns = await tx.query<{ name: string }>(
      'PRAGMA table_info(checklist_items);'
    );
    const itemColumnNames = new Set(itemColumns.map((column) => column.name));

    if (!itemColumnNames.has('quantity')) {
      await tx.execute(
        'ALTER TABLE checklist_items ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;'
      );
    }
    if (!itemColumnNames.has('is_fragile')) {
      await tx.execute(
        'ALTER TABLE checklist_items ADD COLUMN is_fragile INTEGER NOT NULL DEFAULT 0;'
      );
    }
    if (!itemColumnNames.has('expires')) {
      await tx.execute(
        'ALTER TABLE checklist_items ADD COLUMN expires INTEGER NOT NULL DEFAULT 0;'
      );
    }
    if (!itemColumnNames.has('expiration_date')) {
      await tx.execute(
        'ALTER TABLE checklist_items ADD COLUMN expiration_date TEXT;'
      );
    }
    if (!itemColumnNames.has('image_uri')) {
      await tx.execute(
        'ALTER TABLE checklist_items ADD COLUMN image_uri TEXT;'
      );
    }
  },
};
