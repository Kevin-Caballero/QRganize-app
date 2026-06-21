import { Migration } from './migration.interface';

/**
 * Creates the `schema_version` table used by the migration runner to track
 * which migrations have already been applied.
 */
export const migration001SchemaVersion: Migration = {
  version: 1,
  description: 'Create schema_version table',
  async up(tx) {
    await tx.execute(
      `CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );`
    );
  },
};
