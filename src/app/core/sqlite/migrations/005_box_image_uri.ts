import { Migration } from './migration.interface';

/**
 * Adds `image_uri` to `boxes`, backing `LocalBox.imageUri` (see
 * docs/specs.md Spec 002's addendum: "Spec 003 home-screen wiring" decided
 * the home UI needs a box photo field that didn't exist in the original
 * `002_boxes.ts` schema). Stores a local file URI/path, never a blob — per
 * docs/conventions.md.
 */
export const migration005BoxImageUri: Migration = {
  version: 5,
  description: 'Add image_uri column to boxes',
  async up(tx) {
    const columns = await tx.query<{ name: string }>(
      "PRAGMA table_info(boxes);"
    );
    const hasImageUri = columns.some((column) => column.name === 'image_uri');
    if (!hasImageUri) {
      await tx.execute(
        "ALTER TABLE boxes ADD COLUMN image_uri TEXT NOT NULL DEFAULT '';"
      );
    }
  },
};
