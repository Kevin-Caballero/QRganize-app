import { LocalItem } from '../models/local-item';
import { ItemRepository } from './item.repository.interface';

/**
 * In-memory fake `ItemRepository`, with no SQLite dependency. Per
 * docs/conventions.md ("Repository interfaces get a fake/in-memory
 * implementation for testing Feature Services"), this exists so a later
 * spec's Feature Service tests can depend on an `ItemRepository` without
 * touching real SQLite. Not used by any production code in this spec.
 *
 * Mirrors `box-fake.repository.ts`. Note: unlike the real
 * `ItemSqliteRepository`, this fake does not enforce a foreign key to a
 * `boxes` table — it has no concept of boxes at all — since FK enforcement
 * is a storage-layer concern out of scope for a Feature Service fake.
 *
 * Per Spec 011 ("Per-user local data scoping"), this fake also enforces the
 * `firebaseUid` filter on every method, so Feature Service tests exercise
 * real scoping behavior rather than a no-op fake.
 */
export class ItemFakeRepository implements ItemRepository {
  private readonly items = new Map<string, LocalItem & { firebaseUid: string }>();

  async create(item: LocalItem, firebaseUid: string): Promise<LocalItem> {
    if (item.quantity < 1) {
      throw new Error('Item quantity must be at least 1.');
    }
    const now = new Date().toISOString();
    const toInsert: LocalItem = { ...item, createdAt: now, updatedAt: now };
    this.items.set(toInsert.id, { ...toInsert, firebaseUid });
    return { ...toInsert };
  }

  async findById(id: string, firebaseUid: string): Promise<LocalItem | null> {
    const item = this.items.get(id);
    if (!item || item.firebaseUid !== firebaseUid) {
      return null;
    }
    const { firebaseUid: _uid, ...rest } = item;
    return { ...rest };
  }

  async findByBoxId(
    boxId: string,
    firebaseUid: string,
    options: { includeArchived?: boolean; includeDeleted?: boolean } = {}
  ): Promise<LocalItem[]> {
    const { includeArchived = false, includeDeleted = false } = options;
    return [...this.items.values()]
      .filter((item) => item.boxId === boxId)
      .filter((item) => item.firebaseUid === firebaseUid)
      .filter((item) => includeDeleted || !item.deletedAt)
      .filter((item) => includeArchived || item.status !== 'archived')
      .map(({ firebaseUid: _uid, ...rest }) => ({ ...rest }));
  }

  async findAll(
    firebaseUid: string,
    options: { includeArchived?: boolean; includeDeleted?: boolean } = {}
  ): Promise<LocalItem[]> {
    const { includeArchived = false, includeDeleted = false } = options;
    return [...this.items.values()]
      .filter((item) => item.firebaseUid === firebaseUid)
      .filter((item) => includeDeleted || !item.deletedAt)
      .filter((item) => includeArchived || item.status !== 'archived')
      .map(({ firebaseUid: _uid, ...rest }) => ({ ...rest }));
  }

  async update(
    id: string,
    changes: Partial<Omit<LocalItem, 'id' | 'boxId' | 'createdAt'>>,
    firebaseUid: string
  ): Promise<LocalItem> {
    const existing = this.items.get(id);
    if (!existing || existing.firebaseUid !== firebaseUid) {
      throw new Error(`Item not found: ${id}`);
    }

    const updated: LocalItem & { firebaseUid: string } = {
      ...existing,
      ...changes,
      id: existing.id,
      boxId: existing.boxId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      firebaseUid,
    };
    if (updated.quantity < 1) {
      throw new Error('Item quantity must be at least 1.');
    }
    this.items.set(id, updated);
    const { firebaseUid: _uid, ...rest } = updated;
    return { ...rest };
  }

  async softDelete(id: string, firebaseUid: string): Promise<void> {
    const existing = this.items.get(id);
    if (!existing || existing.firebaseUid !== firebaseUid) {
      throw new Error(`Item not found: ${id}`);
    }
    this.items.set(id, { ...existing, deletedAt: new Date().toISOString() });
  }

  async hardDelete(id: string, firebaseUid: string): Promise<void> {
    const existing = this.items.get(id);
    if (existing && existing.firebaseUid === firebaseUid) {
      this.items.delete(id);
    }
  }

  /** Test helper: clears all in-memory state between specs. */
  reset(): void {
    this.items.clear();
  }
}
