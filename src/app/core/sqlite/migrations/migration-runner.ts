import { SqliteTransaction } from '../sqlite.service';
import { Migration } from './migration.interface';

/**
 * Minimal contract the migration runner needs from the database to do its job:
 * read the highest applied version, and run work atomically. This is satisfied
 * by `SqliteService.transaction` / a query against `schema_version`, but is kept
 * narrow here so the runner can be unit tested without a real SQLite instance.
 */
export interface MigrationRunnerDb {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction(work: (tx: SqliteTransaction) => Promise<void>): Promise<void>;
}

/**
 * Applies all pending migrations (version greater than the highest already
 * recorded in `schema_version`) in ascending order, each inside its own
 * transaction. A migration that throws is not recorded as applied, and the
 * error propagates to the caller.
 *
 * The very first migration (001_schema_version) is responsible for creating
 * the `schema_version` table itself, so reading the highest applied version
 * tolerates that table not existing yet.
 */
export class MigrationRunner {
  constructor(
    private readonly db: MigrationRunnerDb,
    private readonly allMigrations: Migration[]
  ) {}

  async run(): Promise<void> {
    const pending = [...this.allMigrations]
      .sort((a, b) => a.version - b.version)
      .filter((migration) => migration.version > 0);

    const appliedVersion = await this.getCurrentVersion();
    const toApply = pending.filter(
      (migration) => migration.version > appliedVersion
    );

    for (const migration of toApply) {
      await this.applyMigration(migration);
    }
  }

  private async getCurrentVersion(): Promise<number> {
    try {
      const rows = await this.db.query<{ version: number }>(
        'SELECT MAX(version) as version FROM schema_version;'
      );
      const version = rows[0]?.version;
      return typeof version === 'number' ? version : 0;
    } catch {
      // schema_version does not exist yet (first run ever).
      return 0;
    }
  }

  private async applyMigration(migration: Migration): Promise<void> {
    await this.db.transaction(async (tx) => {
      await migration.up(tx);
      await tx.execute('INSERT INTO schema_version (version) VALUES (?);', [
        migration.version,
      ]);
    });
  }
}
