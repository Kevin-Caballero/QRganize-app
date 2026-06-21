import { Migration } from './migration.interface';

/**
 * Adds `linked_item_id` to `checklist_items`, backing
 * `LocalChecklistItem.linkedItemId` (see docs/specs.md Spec 018:
 * checking a box-linked checklist item creates the corresponding
 * box item, and records the resulting item's id back onto the
 * checklist item to prevent duplicate creation).
 */
export const migration010ChecklistItemLinkedItem: Migration = {
  version: 10,
  description: 'Add linked_item_id column to checklist_items',
  async up(tx) {
    const columns = await tx.query<{ name: string }>(
      'PRAGMA table_info(checklist_items);'
    );
    const names = new Set(columns.map((column) => column.name));

    if (!names.has('linked_item_id')) {
      await tx.execute(
        'ALTER TABLE checklist_items ADD COLUMN linked_item_id TEXT;'
      );
    }
  },
};
