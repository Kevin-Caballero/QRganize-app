import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { SqliteService } from './sqlite.service';

/**
 * Focused regression test for the Spec 004 "Approved SQLite foundation
 * change": `SqliteService.initialize()` must issue `PRAGMA foreign_keys =
 * ON;` immediately after opening the connection and before running
 * migrations, so the `items` table's `ON DELETE CASCADE` (see
 * `003_items.ts`) reliably fires — SQLite defaults `foreign_keys` to OFF
 * per-connection otherwise.
 *
 * This does not boot the real Capacitor SQLite plugin (no native/web store
 * available in Karma) — instead it stubs just enough of the
 * `SQLiteConnection`/`SQLiteDBConnection` surface that `initialize()` calls,
 * and asserts the PRAGMA statement is sent to the connection before any
 * migration statement.
 */
describe('SqliteService foreign_keys pragma', () => {
  let executedStatements: string[];
  let fakeDb: {
    open: jasmine.Spy;
    execute: jasmine.Spy;
    run: jasmine.Spy;
    query: jasmine.Spy;
    beginTransaction: jasmine.Spy;
    commitTransaction: jasmine.Spy;
    rollbackTransaction: jasmine.Spy;
  };

  beforeEach(() => {
    executedStatements = [];

    fakeDb = {
      open: jasmine.createSpy('open').and.resolveTo(undefined),
      execute: jasmine
        .createSpy('execute')
        .and.callFake(async (sql: string) => {
          executedStatements.push(sql);
          return { changes: { changes: 0 } };
        }),
      run: jasmine.createSpy('run').and.resolveTo({ changes: { changes: 0 } }),
      query: jasmine.createSpy('query').and.callFake(async (sql: string) => {
        if (sql.includes('schema_version')) {
          // Pretend no migrations have been applied yet, and let the runner's
          // CREATE TABLE / inserts run as no-ops via `run`/`execute` spies.
          throw new Error('no such table: schema_version');
        }
        return { values: [] };
      }),
      beginTransaction: jasmine
        .createSpy('beginTransaction')
        .and.resolveTo(undefined),
      commitTransaction: jasmine
        .createSpy('commitTransaction')
        .and.resolveTo(undefined),
      rollbackTransaction: jasmine
        .createSpy('rollbackTransaction')
        .and.resolveTo(undefined),
    };

    spyOn(Capacitor, 'getPlatform').and.returnValue('android');
    spyOn(SQLiteConnection.prototype, 'checkConnectionsConsistency').and.resolveTo(
      { result: false }
    );
    spyOn(SQLiteConnection.prototype, 'isConnection').and.resolveTo({
      result: false,
    });
    spyOn(SQLiteConnection.prototype, 'createConnection').and.resolveTo(
      fakeDb as never
    );

    TestBed.configureTestingModule({
      providers: [{ provide: CapacitorSQLite, useValue: {} }],
    });
  });

  it('issues PRAGMA foreign_keys = ON right after opening the connection, before any migration runs', async () => {
    const service = TestBed.inject(SqliteService);

    await service.initialize();

    expect(fakeDb.open).toHaveBeenCalled();
    expect(executedStatements.length).toBeGreaterThan(0);
    expect(executedStatements[0]).toContain('PRAGMA foreign_keys = ON');

    // Issued after open(), before any CREATE TABLE / migration statement.
    const firstMigrationStatementIndex = executedStatements.findIndex((sql) =>
      sql.includes('CREATE TABLE')
    );
    const pragmaIndex = executedStatements.findIndex((sql) =>
      sql.includes('PRAGMA foreign_keys')
    );
    expect(pragmaIndex).toBeGreaterThan(-1);
    if (firstMigrationStatementIndex > -1) {
      expect(pragmaIndex).toBeLessThan(firstMigrationStatementIndex);
    }
  });
});
