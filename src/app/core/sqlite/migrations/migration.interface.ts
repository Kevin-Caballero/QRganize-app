import { SqliteTransaction } from '../sqlite.service';

/**
 * Contract for a single, sequential, forward-only database migration.
 * Migration files live under `core/sqlite/migrations/`, named `NNN_description.ts`,
 * and are never edited after merge — only appended to (see docs/conventions.md).
 */
export interface Migration {
  /** Sequential, unique, ascending version number for this migration. */
  version: number;

  /** Short human-readable description of what this migration does. */
  description: string;

  /** Applies the migration using the given transaction. */
  up(tx: SqliteTransaction): Promise<void>;
}
