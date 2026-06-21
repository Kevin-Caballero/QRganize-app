import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { MigrationRunner } from './migrations/migration-runner';
import { migrations } from './migrations/migrations';

const DB_NAME = 'qrganize';

/**
 * Scoped database access handed to migrations and `transaction()` callers.
 * Every statement runs against the same underlying connection without an
 * implicit commit, so the caller controls atomicity.
 */
export interface SqliteTransaction {
  execute(sql: string, params?: unknown[]): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

/**
 * Generic, entity-agnostic SQLite access for the app.
 *
 * This service knows nothing about boxes/items/checklists — it only opens the
 * database, runs pending migrations, and exposes execute/query/transaction
 * primitives for repository implementations to build on (see
 * docs/architecture.md mandatory layering).
 *
 * On native platforms (Android) it talks to the real SQLite plugin. On web
 * (`ng serve`) it registers the `jeep-sqlite` web component backed by sql.js,
 * since `@capacitor-community/sqlite` has no native web implementation.
 */
@Injectable({
  providedIn: 'root',
})
export class SqliteService {
  private readonly sqlite = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | undefined;
  private initialization: Promise<void> | undefined;

  /**
   * Opens/creates the database, registers the web store on browser, and runs
   * any pending migrations. Safe to call more than once — subsequent calls
   * resolve without re-opening the connection or re-applying migrations.
   */
  async initialize(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.doInitialize().catch((error) => {
        // Allow a retry on the next call if initialization failed.
        this.initialization = undefined;
        throw error;
      });
    }
    return this.initialization;
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    const db = this.requireDb();
    await db.run(sql, params);
    await this.persistWebStore();
  }

  /**
   * One-time backfill for Spec 011 ("Per-user local data scoping"). Assigns
   * the given `firebaseUid` to every pre-existing `boxes`/`items`/
   * `checklists` row that still has a NULL `firebase_uid` (i.e. created
   * before migration 009 ran, or under whatever account happened to be
   * signed in before this spec existed).
   *
   * Deliberately NOT run from inside migration 009's `up()` — schema
   * migrations execute at `SqliteService.initialize()` time, before/
   * independently of any specific Firebase sign-in event, so "who is the
   * current user" is not known yet at that point. Instead, this is called
   * by `AppStartupRouteService.resolveStartupRoute()` (see that file),
   * which already runs once per app start, after `SqliteService.initialize()`
   * has completed and after the current Firebase auth state has resolved.
   * Safe to call more than once: once every row has a non-null
   * `firebase_uid`, the `WHERE firebase_uid IS NULL` clauses simply match no
   * rows.
   */
  async backfillFirebaseUid(firebaseUid: string): Promise<void> {
    await this.execute(
      'UPDATE boxes SET firebase_uid = ? WHERE firebase_uid IS NULL;',
      [firebaseUid]
    );
    await this.execute(
      'UPDATE items SET firebase_uid = ? WHERE firebase_uid IS NULL;',
      [firebaseUid]
    );
    await this.execute(
      'UPDATE checklists SET firebase_uid = ? WHERE firebase_uid IS NULL;',
      [firebaseUid]
    );
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = this.requireDb();
    const result = await db.query(sql, params);
    return (result.values ?? []) as T[];
  }

  async transaction(
    work: (tx: SqliteTransaction) => Promise<void>
  ): Promise<void> {
    const db = this.requireDb();
    await db.beginTransaction();
    try {
      await work(this.createTransactionScope(db));
      await db.commitTransaction();
      await this.persistWebStore();
    } catch (error) {
      await db.rollbackTransaction();
      throw error;
    }
  }

  /**
   * On web, `@capacitor-community/sqlite` runs the database in an
   * in-memory sql.js instance backed by `jeep-sqlite`; writes are NOT
   * automatically flushed to its IndexedDB-backed store. Without this call,
   * every write only lives in memory and is lost on page reload. Native
   * platforms persist to a real file via the OS SQLite driver and don't
   * need this — `saveToStore` is a no-op there in practice, but we still
   * gate on platform to avoid an unnecessary call.
   */
  private async persistWebStore(): Promise<void> {
    if (Capacitor.getPlatform() === 'web') {
      await this.sqlite.saveToStore(DB_NAME);
    }
  }

  private async doInitialize(): Promise<void> {
    if (Capacitor.getPlatform() === 'web') {
      await this.registerWebStore();
    }

    this.db = await this.openConnection();
    await this.db.open();
    // SQLite defaults `foreign_keys` to OFF per-connection; without this,
    // `ON DELETE CASCADE` (used by the `items` table's FK to `boxes`, see
    // Spec 004) would not reliably fire. Must run before any migration that
    // depends on FK enforcement.
    await this.db.execute('PRAGMA foreign_keys = ON;');

    const runner = new MigrationRunner(
      {
        query: (sql, params) => this.query(sql, params),
        transaction: (work) => this.transaction(work),
      },
      migrations
    );
    await runner.run();
  }

  private async openConnection(): Promise<SQLiteDBConnection> {
    const isConsistent = await this.sqlite.checkConnectionsConsistency();
    const alreadyOpen = await this.sqlite.isConnection(DB_NAME, false);

    if (isConsistent.result && alreadyOpen.result) {
      return this.sqlite.retrieveConnection(DB_NAME, false);
    }

    return this.sqlite.createConnection(
      DB_NAME,
      false,
      'no-encryption',
      1,
      false
    );
  }

  private async registerWebStore(): Promise<void> {
    // jeep-sqlite defines the <jeep-sqlite> custom element used by the
    // plugin's web implementation to persist data via sql.js. It only needs
    // to be defined once per page load.
    if (!customElements.get('jeep-sqlite')) {
      const { defineCustomElements } = await import('jeep-sqlite/loader');
      await defineCustomElements(window);

      const jeepSqliteEl = document.createElement('jeep-sqlite');
      document.body.appendChild(jeepSqliteEl);
      await customElements.whenDefined('jeep-sqlite');
    }

    await this.sqlite.initWebStore();
  }

  private createTransactionScope(db: SQLiteDBConnection): SqliteTransaction {
    return {
      execute: async (sql: string, params: unknown[] = []) => {
        // transaction=false: this statement runs inside the transaction
        // already opened by `transaction()` below. Letting it default to
        // true makes the plugin attempt its own nested begin/commit, which
        // SQLite doesn't support and leaves the outer transaction in a
        // state where a later rollback fails with "no transaction is active".
        await db.run(sql, params, false);
      },
      query: async <T>(sql: string, params: unknown[] = []) => {
        const result = await db.query(sql, params);
        return (result.values ?? []) as T[];
      },
    };
  }

  private requireDb(): SQLiteDBConnection {
    if (!this.db) {
      throw new Error(
        'SqliteService used before initialize() completed. Call initialize() first.'
      );
    }
    return this.db;
  }
}
