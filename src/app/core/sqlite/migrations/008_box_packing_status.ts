import { Migration } from './migration.interface';

/**
 * Adds `packing_status` to `boxes`, backing `LocalBox.packingStatus`
 * (see docs/specs.md Spec 009: a packing-progress lifecycle
 * (packing/sealed) distinct from the existing `status` (active/archived)
 * soft-delete-adjacent lifecycle).
 */
export const migration008BoxPackingStatus: Migration = {
  version: 8,
  description: "Add packing_status column to boxes",
  async up(tx) {
    const columns = await tx.query<{ name: string }>(
      'PRAGMA table_info(boxes);'
    );
    const names = new Set(columns.map((column) => column.name));

    if (!names.has('packing_status')) {
      await tx.execute(
        "ALTER TABLE boxes ADD COLUMN packing_status TEXT NOT NULL DEFAULT 'packing';"
      );
    }
  },
};
