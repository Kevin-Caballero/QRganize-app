import { MigrationRunner, MigrationRunnerDb } from './migration-runner';
import { Migration } from './migration.interface';
import { SqliteTransaction } from '../sqlite.service';

/**
 * In-memory fake of the narrow DB surface the migration runner needs.
 * Models a `schema_version` table well enough to exercise the runner's
 * logic without touching a real SQLite instance.
 */
class FakeDb implements MigrationRunnerDb {
  private readonly appliedVersions: number[] = [];
  schemaVersionTableExists = false;

  async query<T>(sql: string): Promise<T[]> {
    if (!this.schemaVersionTableExists) {
      throw new Error('no such table: schema_version');
    }
    if (sql.includes('MAX(version)')) {
      const max =
        this.appliedVersions.length > 0
          ? Math.max(...this.appliedVersions)
          : null;
      return [{ version: max }] as unknown as T[];
    }
    return [] as T[];
  }

  async transaction(
    work: (tx: SqliteTransaction) => Promise<void>
  ): Promise<void> {
    const recordedInThisTx: number[] = [];
    const tx: SqliteTransaction = {
      execute: async (sql: string, params: unknown[] = []) => {
        if (sql.includes('CREATE TABLE IF NOT EXISTS schema_version')) {
          this.schemaVersionTableExists = true;
        } else if (sql.includes('INSERT INTO schema_version')) {
          recordedInThisTx.push(params[0] as number);
        }
      },
      query: async <T>() => [] as T[],
    };

    await work(tx);
    // Only commit (record as applied) once `work` resolves without throwing,
    // mirroring SqliteService.transaction's commit/rollback behavior.
    this.appliedVersions.push(...recordedInThisTx);
  }

  getAppliedVersions(): number[] {
    return [...this.appliedVersions];
  }
}

function migration(version: number, up: Migration['up']): Migration {
  return { version, description: `migration ${version}`, up };
}

describe('MigrationRunner', () => {
  it('applies migration 001_schema_version exactly once', async () => {
    const db = new FakeDb();
    const created: number[] = [];
    const m1 = migration(1, async (tx) => {
      await tx.execute(
        'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);'
      );
      created.push(1);
    });

    const runner = new MigrationRunner(db, [m1]);
    await runner.run();

    expect(created).toEqual([1]);
    expect(db.getAppliedVersions()).toEqual([1]);
  });

  it('is idempotent on a second initialize()/run() call', async () => {
    const db = new FakeDb();
    const created: number[] = [];
    const m1 = migration(1, async (tx) => {
      await tx.execute(
        'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);'
      );
      created.push(1);
    });

    const runner = new MigrationRunner(db, [m1]);
    await runner.run();
    await runner.run();

    expect(created).toEqual([1]);
    expect(db.getAppliedVersions()).toEqual([1]);
  });

  it('applies only migrations newer than the highest recorded version, in ascending order', async () => {
    const db = new FakeDb();
    const applyOrder: number[] = [];
    const m1 = migration(1, async (tx) => {
      await tx.execute(
        'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);'
      );
      applyOrder.push(1);
    });
    const m3 = migration(3, async () => {
      applyOrder.push(3);
    });
    const m2 = migration(2, async () => {
      applyOrder.push(2);
    });

    const runner = new MigrationRunner(db, [m3, m1, m2]);
    await runner.run();

    expect(applyOrder).toEqual([1, 2, 3]);
    expect(db.getAppliedVersions()).toEqual([1, 2, 3]);

    const moreApplied: number[] = [];
    const m4 = migration(4, async () => {
      moreApplied.push(4);
    });
    const runnerAgain = new MigrationRunner(db, [m1, m2, m3, m4]);
    await runnerAgain.run();

    expect(moreApplied).toEqual([4]);
    expect(db.getAppliedVersions()).toEqual([1, 2, 3, 4]);
  });

  it('does not record a failing migration as applied, and propagates the error', async () => {
    const db = new FakeDb();
    const m1 = migration(1, async (tx) => {
      await tx.execute(
        'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);'
      );
    });
    const failing = migration(2, async () => {
      throw new Error('boom');
    });

    const runner = new MigrationRunner(db, [m1, failing]);

    await expectAsync(runner.run()).toBeRejectedWithError('boom');
    expect(db.getAppliedVersions()).toEqual([1]);

    // Retrying after fixing the migration should apply it cleanly.
    const fixed = migration(2, async () => undefined);
    const retryRunner = new MigrationRunner(db, [m1, fixed]);
    await retryRunner.run();
    expect(db.getAppliedVersions()).toEqual([1, 2]);
  });
});
