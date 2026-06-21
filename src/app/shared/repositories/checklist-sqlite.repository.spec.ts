import { TestBed } from '@angular/core/testing';
import { SqliteService } from '../../core/sqlite/sqlite.service';
import {
  ChecklistStatus,
  LocalChecklist,
  LocalChecklistItem,
} from '../models/local-checklist';
import { ChecklistSqliteRepository } from './checklist-sqlite.repository';

/**
 * Minimal in-memory SQLite stand-in covering exactly the statements
 * `ChecklistSqliteRepository` issues against the `checklists`/
 * `checklist_items` tables (see 004_checklists.ts), mirroring the approach
 * in `item-sqlite.repository.spec.ts` (Spec 004).
 *
 * FK/cascade testing decision: same as Spec 004 — a plain Map-based fake has
 * no SQL engine behind it and cannot faithfully simulate a real foreign key
 * constraint or `ON DELETE CASCADE`. Pulling in a real SQLite engine
 * (sql.js/jeep-sqlite's WASM dependency) inside Karma was rejected for the
 * same reasons documented in Spec 004's spec file: it is only a transitive
 * dependency and would add flakiness for marginal benefit.
 *
 * Instead, this fake models the *real* relational contract `checklist_items`
 * has with `checklists`: it keeps its own small in-memory `checklists` id
 * set, enforces the FK on INSERT (a non-existent `checklist_id` throws,
 * exactly like a real FK violation would once `PRAGMA foreign_keys = ON` is
 * active), and cascades deletes from `checklists` to `checklist_items` only
 * for a genuine `DELETE FROM checklists`, never for the soft-delete
 * `UPDATE checklists SET deleted_at = ...`. This reproduces the exact,
 * observable behavior contract this spec's acceptance criteria call for (FK
 * rejection + hard-delete cascade + soft-delete non-cascade) without
 * depending on a real SQLite engine inside the unit test, at the cost of not
 * exercising SQLite's own FK engine bit-for-bit — same residual risk called
 * out in Spec 004's report, repeated here for this spec.
 *
 * Per Spec 011 ("Per-user local data scoping"), `checklists` gets a
 * `firebase_uid` column (migration 009); `checklist_items` does not — this
 * fake models the real implementation's transitive-scoping approach
 * (`JOIN`/subquery against the owning checklist's `firebase_uid`) for every
 * item statement.
 */
interface RawChecklistRow {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  firebase_uid: string | null;
}

interface RawChecklistItemRow {
  id: string;
  checklist_id: string;
  title: string;
  notes: string;
  is_completed: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

class FakeSqliteService {
  private readonly checklists = new Map<string, RawChecklistRow>();
  private readonly items = new Map<string, RawChecklistItemRow>();

  /** Test seam: simulates a real `DELETE FROM checklists WHERE id = ?` with FK cascade. */
  hardDeleteChecklistDirect(id: string): void {
    this.checklists.delete(id);
    for (const [itemId, row] of this.items.entries()) {
      if (row.checklist_id === id) {
        this.items.delete(itemId);
      }
    }
  }

  private checklistOwnedBy(checklistId: string, firebaseUid: string): boolean {
    const checklist = this.checklists.get(checklistId);
    return !!checklist && checklist.firebase_uid === firebaseUid;
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    if (sql.startsWith('INSERT INTO checklists')) {
      const [
        id,
        title,
        description,
        status,
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
        string | null,
        string
      ];
      this.checklists.set(id, {
        id,
        title,
        description,
        status,
        created_at,
        updated_at,
        deleted_at,
        firebase_uid,
      });
      return;
    }

    if (sql.startsWith('UPDATE checklists SET') && sql.includes('title = ?')) {
      const [title, description, status, updated_at, deleted_at, id, firebase_uid] =
        params as [
          string,
          string,
          string,
          string,
          string | null,
          string,
          string
        ];
      const existing = this.checklists.get(id);
      if (!existing || existing.firebase_uid !== firebase_uid) {
        throw new Error(`Checklist not found: ${id}`);
      }
      this.checklists.set(id, {
        ...existing,
        title,
        description,
        status,
        updated_at,
        deleted_at,
      });
      return;
    }

    if (
      sql.startsWith('UPDATE checklists SET') &&
      sql.includes('deleted_at = ?') &&
      !sql.includes('title = ?')
    ) {
      const [deleted_at, id, firebase_uid] = params as [string, string, string];
      const existing = this.checklists.get(id);
      if (existing && existing.firebase_uid === firebase_uid) {
        this.checklists.set(id, { ...existing, deleted_at });
      }
      return;
    }

    if (sql.startsWith('DELETE FROM checklists')) {
      const [id, firebase_uid] = params as [string, string];
      const existing = this.checklists.get(id);
      if (existing && existing.firebase_uid === firebase_uid) {
        this.hardDeleteChecklistDirect(id);
      }
      return;
    }

    if (sql.startsWith('INSERT INTO checklist_items')) {
      const [
        id,
        checklist_id,
        title,
        notes,
        is_completed,
        sort_order,
        created_at,
        updated_at,
        deleted_at,
      ] = params as [
        string,
        string,
        string,
        string,
        number,
        number,
        string,
        string,
        string | null
      ];

      if (!this.checklists.has(checklist_id)) {
        throw new Error(
          `FOREIGN KEY constraint failed: no checklist with id ${checklist_id}`
        );
      }

      this.items.set(id, {
        id,
        checklist_id,
        title,
        notes,
        is_completed,
        sort_order,
        created_at,
        updated_at,
        deleted_at,
      });
      return;
    }

    if (
      sql.startsWith('UPDATE checklist_items SET') &&
      sql.includes('title = ?')
    ) {
      const [
        title,
        notes,
        is_completed,
        sort_order,
        updated_at,
        deleted_at,
        id,
        firebase_uid,
      ] = params as [
        string,
        string,
        number,
        number,
        string,
        string | null,
        string,
        string
      ];
      const existing = this.items.get(id);
      if (!existing || !this.checklistOwnedBy(existing.checklist_id, firebase_uid)) {
        throw new Error(`Checklist item not found: ${id}`);
      }
      this.items.set(id, {
        ...existing,
        title,
        notes,
        is_completed,
        sort_order,
        updated_at,
        deleted_at,
      });
      return;
    }

    if (
      sql.startsWith('UPDATE checklist_items SET') &&
      sql.includes('sort_order = ?') &&
      sql.includes('updated_at = ?') &&
      !sql.includes('title = ?')
    ) {
      const [sort_order, updated_at, id] = params as [
        number,
        string,
        string
      ];
      const existing = this.items.get(id);
      if (existing) {
        this.items.set(id, { ...existing, sort_order, updated_at });
      }
      return;
    }

    if (
      sql.startsWith('UPDATE checklist_items SET') &&
      sql.includes('deleted_at = ?') &&
      !sql.includes('title = ?')
    ) {
      const [deleted_at, id, firebase_uid] = params as [
        string,
        string,
        string
      ];
      const existing = this.items.get(id);
      if (existing && this.checklistOwnedBy(existing.checklist_id, firebase_uid)) {
        this.items.set(id, { ...existing, deleted_at });
      }
      return;
    }

    if (sql.startsWith('DELETE FROM checklist_items')) {
      const [id, firebase_uid] = params as [string, string];
      const existing = this.items.get(id);
      if (existing && this.checklistOwnedBy(existing.checklist_id, firebase_uid)) {
        this.items.delete(id);
      }
      return;
    }

    throw new Error(`FakeSqliteService: unsupported execute SQL: ${sql}`);
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (sql.startsWith('SELECT * FROM checklists WHERE id = ?')) {
      const [id, firebase_uid] = params as [string, string];
      const row = this.checklists.get(id);
      return (row && row.firebase_uid === firebase_uid
        ? [row]
        : []) as unknown as T[];
    }

    if (sql.startsWith('SELECT * FROM checklists')) {
      const [firebase_uid] = params as [string];
      const includeDeleted = !sql.includes('deleted_at IS NULL');
      const includeArchived = !sql.includes("status != 'archived'");
      const all = [...this.checklists.values()]
        .filter((row) => row.firebase_uid === firebase_uid)
        .filter((row) => includeDeleted || row.deleted_at === null)
        .filter((row) => includeArchived || row.status !== 'archived');
      return all as unknown as T[];
    }

    if (
      sql.includes('FROM checklist_items ci') &&
      sql.includes('ci.id = ?')
    ) {
      // findItemById: joined lookup by item id + owning checklist's uid
      const [id, firebase_uid] = params as [string, string];
      const row = this.items.get(id);
      if (
        row &&
        this.checklistOwnedBy(row.checklist_id, firebase_uid)
      ) {
        return [row] as unknown as T[];
      }
      return [];
    }

    if (
      sql.includes('FROM checklist_items ci') &&
      sql.includes('ci.checklist_id = ?')
    ) {
      // findItemsByChecklistId: joined lookup by checklist id + owning
      // checklist's uid
      const [checklistId, firebase_uid] = params as [string, string];
      const includeDeleted = !sql.includes('deleted_at IS NULL');
      if (!this.checklistOwnedBy(checklistId, firebase_uid)) {
        return [];
      }
      const all = [...this.items.values()]
        .filter((row) => row.checklist_id === checklistId)
        .filter((row) => includeDeleted || row.deleted_at === null);
      return all as unknown as T[];
    }

    throw new Error(`FakeSqliteService: unsupported query SQL: ${sql}`);
  }

  async transaction(
    work: (tx: {
      execute: typeof this.execute;
      query: typeof this.query;
    }) => Promise<void>
  ): Promise<void> {
    await work({ execute: this.execute.bind(this), query: this.query.bind(this) });
  }
}

function makeChecklist(overrides: Partial<LocalChecklist> = {}): LocalChecklist {
  return {
    id: crypto.randomUUID(),
    title: 'Moving checklist',
    description: '',
    status: ChecklistStatus.ACTIVE,
    createdAt: 'will-be-overwritten',
    updatedAt: 'will-be-overwritten',
    ...overrides,
  };
}

function makeItem(
  checklistId: string,
  overrides: Partial<Omit<LocalChecklistItem, 'sortOrder'>> & {
    sortOrder?: number;
  } = {}
): Omit<LocalChecklistItem, 'sortOrder'> & { sortOrder?: number } {
  const { sortOrder, ...rest } = overrides;
  return {
    id: crypto.randomUUID(),
    checklistId,
    title: 'Pack kitchen boxes',
    notes: '',
    isCompleted: false,
    createdAt: 'will-be-overwritten',
    updatedAt: 'will-be-overwritten',
    ...rest,
    ...(sortOrder !== undefined ? { sortOrder } : {}),
  };
}

describe('ChecklistSqliteRepository', () => {
  let repository: ChecklistSqliteRepository;
  let fakeSqlite: FakeSqliteService;
  let checklistId: string;
  const UID = 'user-a';
  const OTHER_UID = 'user-b';

  beforeEach(async () => {
    fakeSqlite = new FakeSqliteService();
    TestBed.configureTestingModule({
      providers: [{ provide: SqliteService, useValue: fakeSqlite }],
    });
    repository = TestBed.inject(ChecklistSqliteRepository);

    const checklist = await repository.createChecklist(makeChecklist(), UID);
    checklistId = checklist.id;
  });

  it('round-trips createChecklist -> findChecklistById -> updateChecklist -> softDeleteChecklist -> excluded from default findAllChecklists -> included with includeDeleted', async () => {
    const created = await repository.createChecklist(
      makeChecklist({ title: 'Bedroom checklist' }),
      UID
    );
    expect(created.id).toBeTruthy();
    expect(created.title).toBe('Bedroom checklist');
    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBeTruthy();
    expect(created.deletedAt).toBeUndefined();

    const found = await repository.findChecklistById(created.id, UID);
    expect(found).not.toBeNull();
    expect(found?.title).toBe('Bedroom checklist');

    const updated = await repository.updateChecklist(
      created.id,
      { title: 'Renamed checklist' },
      UID
    );
    expect(updated.title).toBe('Renamed checklist');
    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);

    await repository.softDeleteChecklist(created.id, UID);
    const afterDelete = await repository.findChecklistById(created.id, UID);
    expect(afterDelete?.deletedAt).toBeTruthy();

    const defaultList = await repository.findAllChecklists(UID);
    expect(
      defaultList.find((checklist) => checklist.id === created.id)
    ).toBeUndefined();

    const withDeleted = await repository.findAllChecklists(UID, {
      includeDeleted: true,
    });
    expect(
      withDeleted.find((checklist) => checklist.id === created.id)
    ).toBeTruthy();
  });

  it('findAllChecklists excludes archived and soft-deleted checklists by default', async () => {
    const active = await repository.createChecklist(
      makeChecklist({ title: 'Active checklist' }),
      UID
    );
    const archived = await repository.createChecklist(
      makeChecklist({
        title: 'Archived checklist',
        status: ChecklistStatus.ARCHIVED,
      }),
      UID
    );
    const toDelete = await repository.createChecklist(
      makeChecklist({ title: 'Deleted checklist' }),
      UID
    );
    await repository.softDeleteChecklist(toDelete.id, UID);

    const defaultList = await repository.findAllChecklists(UID);
    const ids = defaultList.map((checklist) => checklist.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(archived.id);
    expect(ids).not.toContain(toDelete.id);

    const withArchived = await repository.findAllChecklists(UID, {
      includeArchived: true,
    });
    expect(withArchived.map((checklist) => checklist.id)).toContain(
      archived.id
    );
  });

  it('hardDeleteChecklist removes the row entirely', async () => {
    const created = await repository.createChecklist(makeChecklist(), UID);
    await repository.hardDeleteChecklist(created.id, UID);

    const found = await repository.findChecklistById(created.id, UID);
    expect(found).toBeNull();

    const withDeletedAndArchived = await repository.findAllChecklists(UID, {
      includeDeleted: true,
      includeArchived: true,
    });
    expect(
      withDeletedAndArchived.find((checklist) => checklist.id === created.id)
    ).toBeUndefined();
  });

  it('rejects createChecklist with an empty/whitespace-only title', async () => {
    await expectAsync(
      repository.createChecklist(makeChecklist({ title: '' }), UID)
    ).toBeRejectedWithError(/title/i);

    await expectAsync(
      repository.createChecklist(makeChecklist({ title: '   ' }), UID)
    ).toBeRejectedWithError(/title/i);
  });

  it('round-trips createItem via findItemsByChecklistId', async () => {
    const created = await repository.createItem(
      makeItem(checklistId, { title: 'Pack books' }),
      UID
    );
    expect(created.id).toBeTruthy();
    expect(created.checklistId).toBe(checklistId);
    expect(created.title).toBe('Pack books');
    expect(created.isCompleted).toBeFalse();
    expect(created.sortOrder).toBe(0);
    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBeTruthy();

    const items = await repository.findItemsByChecklistId(checklistId, UID);
    expect(items.find((item) => item.id === created.id)).toBeTruthy();

    const updated = await repository.updateItem(
      created.id,
      { title: 'Pack all books', isCompleted: true },
      UID
    );
    expect(updated.title).toBe('Pack all books');
    expect(updated.isCompleted).toBeTrue();
    expect(updated.checklistId).toBe(checklistId);
    expect(updated.createdAt).toBe(created.createdAt);
  });

  it('round-trips linkedItemId via updateItem and findItemsByChecklistId (Spec 018)', async () => {
    const created = await repository.createItem(
      makeItem(checklistId, { title: 'Pack books' }),
      UID
    );
    expect(created.linkedItemId).toBeUndefined();

    const updated = await repository.updateItem(
      created.id,
      { linkedItemId: 'some-box-item-id' },
      UID
    );
    expect(updated.linkedItemId).toBe('some-box-item-id');

    const items = await repository.findItemsByChecklistId(checklistId, UID);
    const refetched = items.find((item) => item.id === created.id);
    expect(refetched?.linkedItemId).toBe('some-box-item-id');
  });

  it('rejects createItem with an empty/whitespace-only title', async () => {
    await expectAsync(
      repository.createItem(makeItem(checklistId, { title: '' }), UID)
    ).toBeRejectedWithError(/title/i);

    await expectAsync(
      repository.createItem(makeItem(checklistId, { title: '  ' }), UID)
    ).toBeRejectedWithError(/title/i);
  });

  it('fails to create an item for a non-existent checklistId (FK violation)', async () => {
    await expectAsync(
      repository.createItem(makeItem('non-existent-checklist-id'), UID)
    ).toBeRejected();
  });

  it('createItem without sortOrder gets the next sequential value', async () => {
    const first = await repository.createItem(
      makeItem(checklistId, { title: 'First' }),
      UID
    );
    expect(first.sortOrder).toBe(0);

    const second = await repository.createItem(
      makeItem(checklistId, { title: 'Second' }),
      UID
    );
    expect(second.sortOrder).toBe(1);

    const third = await repository.createItem(
      makeItem(checklistId, { title: 'Third', sortOrder: 10 }),
      UID
    );
    expect(third.sortOrder).toBe(10);

    const fourth = await repository.createItem(
      makeItem(checklistId, { title: 'Fourth' }),
      UID
    );
    expect(fourth.sortOrder).toBe(11);
  });

  it('reorderItems rewrites order correctly and leaves unlisted items untouched', async () => {
    const a = await repository.createItem(makeItem(checklistId, { title: 'A' }), UID);
    const b = await repository.createItem(makeItem(checklistId, { title: 'B' }), UID);
    const c = await repository.createItem(makeItem(checklistId, { title: 'C' }), UID);

    await repository.reorderItems(checklistId, [c.id, a.id, b.id], UID);

    const items = await repository.findItemsByChecklistId(checklistId, UID);
    const byId = new Map(items.map((item) => [item.id, item]));
    expect(byId.get(c.id)?.sortOrder).toBe(0);
    expect(byId.get(a.id)?.sortOrder).toBe(1);
    expect(byId.get(b.id)?.sortOrder).toBe(2);
  });

  it('reorderItems rejects an id that does not belong to the checklist', async () => {
    const a = await repository.createItem(makeItem(checklistId, { title: 'A' }), UID);

    const otherChecklist = await repository.createChecklist(
      makeChecklist({ title: 'Other checklist' }),
      UID
    );
    const foreign = await repository.createItem(
      makeItem(otherChecklist.id, { title: 'Foreign item' }),
      UID
    );

    await expectAsync(
      repository.reorderItems(checklistId, [a.id, foreign.id], UID)
    ).toBeRejected();
  });

  it('hardDeleteChecklist cascades to delete its items', async () => {
    const item = await repository.createItem(makeItem(checklistId), UID);

    fakeSqlite.hardDeleteChecklistDirect(checklistId);

    const items = await repository.findItemsByChecklistId(checklistId, UID, {
      includeDeleted: true,
    });
    expect(items.find((i) => i.id === item.id)).toBeUndefined();
  });

  it('softDeleteChecklist does not affect its items', async () => {
    const item = await repository.createItem(makeItem(checklistId), UID);

    await repository.softDeleteChecklist(checklistId, UID);

    const items = await repository.findItemsByChecklistId(checklistId, UID);
    expect(items.find((i) => i.id === item.id)).toBeTruthy();
    const found = items.find((i) => i.id === item.id);
    expect(found?.deletedAt).toBeUndefined();
  });

  it('softDeleteItem/hardDeleteItem behave like the box/item equivalents', async () => {
    const toSoftDelete = await repository.createItem(
      makeItem(checklistId, { title: 'Soft delete me' }),
      UID
    );
    await repository.softDeleteItem(toSoftDelete.id, UID);

    const defaultItems = await repository.findItemsByChecklistId(checklistId, UID);
    expect(
      defaultItems.find((item) => item.id === toSoftDelete.id)
    ).toBeUndefined();

    const withDeleted = await repository.findItemsByChecklistId(checklistId, UID, {
      includeDeleted: true,
    });
    expect(
      withDeleted.find((item) => item.id === toSoftDelete.id)
    ).toBeTruthy();

    const toHardDelete = await repository.createItem(
      makeItem(checklistId, { title: 'Hard delete me' }),
      UID
    );
    await repository.hardDeleteItem(toHardDelete.id, UID);

    const afterHardDelete = await repository.findItemsByChecklistId(
      checklistId,
      UID,
      { includeDeleted: true }
    );
    expect(
      afterHardDelete.find((item) => item.id === toHardDelete.id)
    ).toBeUndefined();
  });

  it('two concurrent createChecklist calls produce distinct UUIDs without colliding', async () => {
    const [first, second] = await Promise.all([
      repository.createChecklist(makeChecklist({ title: 'Checklist A' }), UID),
      repository.createChecklist(makeChecklist({ title: 'Checklist B' }), UID),
    ]);

    expect(first.id).not.toBe(second.id);
  });

  it('two concurrent createItem calls produce distinct UUIDs without colliding', async () => {
    const [first, second] = await Promise.all([
      repository.createItem(makeItem(checklistId, { title: 'Item A' }), UID),
      repository.createItem(makeItem(checklistId, { title: 'Item B' }), UID),
    ]);

    expect(first.id).not.toBe(second.id);

    const items = await repository.findItemsByChecklistId(checklistId, UID);
    expect(items.length).toBe(2);
  });

  it('scopes every checklist and item method by firebaseUid (Spec 011)', async () => {
    const item = await repository.createItem(
      makeItem(checklistId, { title: 'Owned by A' }),
      UID
    );

    expect(await repository.findChecklistById(checklistId, OTHER_UID)).toBeNull();
    expect(await repository.findAllChecklists(OTHER_UID)).toEqual([]);
    expect(
      await repository.findItemsByChecklistId(checklistId, OTHER_UID)
    ).toEqual([]);

    await expectAsync(
      repository.updateChecklist(checklistId, { title: 'Hijacked' }, OTHER_UID)
    ).toBeRejected();

    await expectAsync(
      repository.createItem(makeItem(checklistId, { title: 'Hijack item' }), OTHER_UID)
    ).toBeRejected();

    await expectAsync(
      repository.updateItem(item.id, { title: 'Hijacked item' }, OTHER_UID)
    ).toBeRejected();

    await repository.softDeleteItem(item.id, OTHER_UID);
    const stillActive = await repository.findItemsByChecklistId(checklistId, UID);
    expect(stillActive.find((i) => i.id === item.id)?.deletedAt).toBeUndefined();

    await repository.hardDeleteItem(item.id, OTHER_UID);
    const stillThere = await repository.findItemsByChecklistId(checklistId, UID);
    expect(stillThere.find((i) => i.id === item.id)).toBeTruthy();
  });
});
