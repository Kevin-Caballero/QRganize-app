import { TestBed } from '@angular/core/testing';
import { SqliteService } from '../../core/sqlite/sqlite.service';
import { BoxStatus, LocalBox } from '../models/local-box';
import { BoxSqliteRepository } from './box-sqlite.repository';

/**
 * Minimal in-memory SQLite stand-in covering exactly the statements
 * `BoxSqliteRepository` issues against the `boxes` table (see
 * 002_boxes.ts). This lets the repository's mapping/filtering logic be
 * unit-tested without a real native/web SQLite connection, mirroring the
 * approach already used for `MigrationRunner` (migration-runner.spec.ts).
 *
 * Per Spec 011 ("Per-user local data scoping"), this fake also models the
 * `firebase_uid` column added by migration 009 and the `AND firebase_uid = ?`
 * filter every statement now carries.
 */
interface RawBoxRow {
  id: string;
  name: string;
  description: string;
  room: string;
  status: string;
  packing_status: string;
  qr_code: string;
  image_uri: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  firebase_uid: string | null;
}

class FakeSqliteService {
  private readonly rows = new Map<string, RawBoxRow>();

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    if (sql.startsWith('INSERT INTO boxes')) {
      const [
        id,
        name,
        description,
        room,
        status,
        packing_status,
        qr_code,
        image_uri,
        created_at,
        updated_at,
        deleted_at,
        firebase_uid,
      ] = params as [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string | null,
        string
      ];
      this.rows.set(id, {
        id,
        name,
        description,
        room,
        status,
        packing_status,
        qr_code,
        image_uri,
        created_at,
        updated_at,
        deleted_at,
        firebase_uid,
      });
      return;
    }

    if (sql.startsWith('UPDATE boxes SET') && sql.includes('deleted_at = ?')) {
      // update(): full column UPDATE ... WHERE id = ? AND firebase_uid = ?
      if (sql.includes('name = ?')) {
        const [
          name,
          description,
          room,
          status,
          packing_status,
          qr_code,
          image_uri,
          updated_at,
          deleted_at,
          id,
          firebase_uid,
        ] = params as [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string | null,
          string,
          string
        ];
        const existing = this.rows.get(id);
        if (!existing || existing.firebase_uid !== firebase_uid) {
          throw new Error(`Box not found: ${id}`);
        }
        this.rows.set(id, {
          ...existing,
          name,
          description,
          room,
          status,
          packing_status,
          qr_code,
          image_uri,
          updated_at,
          deleted_at,
        });
        return;
      }

      // softDelete(): UPDATE boxes SET deleted_at = ? WHERE id = ? AND firebase_uid = ?
      const [deleted_at, id, firebase_uid] = params as [
        string,
        string,
        string
      ];
      const existing = this.rows.get(id);
      if (existing && existing.firebase_uid === firebase_uid) {
        this.rows.set(id, { ...existing, deleted_at });
      }
      return;
    }

    if (sql.startsWith('DELETE FROM boxes')) {
      const [id, firebase_uid] = params as [string, string];
      const existing = this.rows.get(id);
      if (existing && existing.firebase_uid === firebase_uid) {
        this.rows.delete(id);
      }
      return;
    }

    throw new Error(`FakeSqliteService: unsupported execute SQL: ${sql}`);
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (sql.startsWith('SELECT * FROM boxes WHERE id = ?')) {
      const [id, firebase_uid] = params as [string, string];
      const row = this.rows.get(id);
      return (row && row.firebase_uid === firebase_uid
        ? [row]
        : []) as unknown as T[];
    }

    if (sql.startsWith('SELECT * FROM boxes')) {
      const [firebase_uid] = params as [string];
      const includeDeleted = !sql.includes('deleted_at IS NULL');
      const includeArchived = !sql.includes("status != 'archived'");
      const all = [...this.rows.values()]
        .filter((row) => row.firebase_uid === firebase_uid)
        .filter((row) => includeDeleted || row.deleted_at === null)
        .filter((row) => includeArchived || row.status !== 'archived');
      return all as unknown as T[];
    }

    throw new Error(`FakeSqliteService: unsupported query SQL: ${sql}`);
  }

  async transaction(
    work: (tx: { execute: typeof this.execute; query: typeof this.query }) => Promise<void>
  ): Promise<void> {
    await work({ execute: this.execute.bind(this), query: this.query.bind(this) });
  }
}

function makeBox(overrides: Partial<LocalBox> = {}): LocalBox {
  return {
    id: crypto.randomUUID(),
    name: 'Kitchen box',
    description: '',
    room: 'Kitchen',
    status: BoxStatus.ACTIVE,
    packingStatus: 'packing',
    qrCode: 'qr-1',
    createdAt: 'will-be-overwritten',
    updatedAt: 'will-be-overwritten',
    ...overrides,
  };
}

describe('BoxSqliteRepository', () => {
  let repository: BoxSqliteRepository;
  let fakeSqlite: FakeSqliteService;
  const UID = 'user-a';
  const OTHER_UID = 'user-b';

  beforeEach(() => {
    fakeSqlite = new FakeSqliteService();
    TestBed.configureTestingModule({
      providers: [{ provide: SqliteService, useValue: fakeSqlite }],
    });
    repository = TestBed.inject(BoxSqliteRepository);
  });

  it('round-trips create -> findById -> update -> softDelete -> excluded from default findAll -> included with includeDeleted', async () => {
    const created = await repository.create(
      makeBox({ name: 'Garage box' }),
      UID
    );
    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Garage box');
    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBeTruthy();
    expect(created.deletedAt).toBeUndefined();

    const found = await repository.findById(created.id, UID);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Garage box');

    const updated = await repository.update(
      created.id,
      { name: 'Renamed box' },
      UID
    );
    expect(updated.name).toBe('Renamed box');
    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);

    await repository.softDelete(created.id, UID);
    const afterDelete = await repository.findById(created.id, UID);
    expect(afterDelete?.deletedAt).toBeTruthy();

    const defaultList = await repository.findAll(UID);
    expect(defaultList.find((box) => box.id === created.id)).toBeUndefined();

    const withDeleted = await repository.findAll(UID, { includeDeleted: true });
    expect(withDeleted.find((box) => box.id === created.id)).toBeTruthy();
  });

  it('findAll excludes archived and soft-deleted boxes by default', async () => {
    const active = await repository.create(makeBox({ name: 'Active box' }), UID);
    const archived = await repository.create(
      makeBox({ name: 'Archived box', status: BoxStatus.ARCHIVED }),
      UID
    );
    const toDelete = await repository.create(makeBox({ name: 'Deleted box' }), UID);
    await repository.softDelete(toDelete.id, UID);

    const defaultList = await repository.findAll(UID);
    const ids = defaultList.map((box) => box.id);

    expect(ids).toContain(active.id);
    expect(ids).not.toContain(archived.id);
    expect(ids).not.toContain(toDelete.id);

    const withArchived = await repository.findAll(UID, { includeArchived: true });
    expect(withArchived.map((box) => box.id)).toContain(archived.id);
  });

  it('hardDelete removes the row entirely', async () => {
    const created = await repository.create(makeBox(), UID);
    await repository.hardDelete(created.id, UID);

    const found = await repository.findById(created.id, UID);
    expect(found).toBeNull();

    const withDeletedAndArchived = await repository.findAll(UID, {
      includeDeleted: true,
      includeArchived: true,
    });
    expect(withDeletedAndArchived.find((box) => box.id === created.id)).toBeUndefined();
  });

  it('two concurrent creates produce distinct UUIDs without colliding', async () => {
    const [first, second] = await Promise.all([
      repository.create(makeBox({ name: 'Box A' }), UID),
      repository.create(makeBox({ name: 'Box B' }), UID),
    ]);

    expect(first.id).not.toBe(second.id);

    const all = await repository.findAll(UID);
    expect(all.length).toBe(2);
  });

  it('scopes every method by firebaseUid: one user cannot see, update, or delete another user\'s box (Spec 011)', async () => {
    const ownedByA = await repository.create(makeBox({ name: 'A box' }), UID);

    expect(await repository.findById(ownedByA.id, OTHER_UID)).toBeNull();
    expect(await repository.findAll(OTHER_UID)).toEqual([]);

    await expectAsync(
      repository.update(ownedByA.id, { name: 'Hijacked' }, OTHER_UID)
    ).toBeRejected();

    // softDelete/hardDelete silently no-op for the wrong user (no row
    // matches `id AND firebase_uid`) rather than throwing — verify the row
    // is untouched from the real owner's perspective.
    await repository.softDelete(ownedByA.id, OTHER_UID);
    const stillActive = await repository.findById(ownedByA.id, UID);
    expect(stillActive?.deletedAt).toBeUndefined();

    await repository.hardDelete(ownedByA.id, OTHER_UID);
    const stillThere = await repository.findById(ownedByA.id, UID);
    expect(stillThere).not.toBeNull();
  });
});
