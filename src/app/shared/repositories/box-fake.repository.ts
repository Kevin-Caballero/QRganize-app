import { LocalBox } from '../models/local-box';
import { BoxRepository } from './box.repository.interface';

/**
 * In-memory fake `BoxRepository`, with no SQLite dependency. Per
 * docs/conventions.md ("Repository interfaces get a fake/in-memory
 * implementation for testing Feature Services"), this exists so Spec 004's
 * Feature Service tests can depend on a `BoxRepository` without touching
 * real SQLite. Not used by any production code in this spec.
 *
 * Colocated under `shared/repositories/` (next to the interface and the
 * real SQLite implementation) rather than under a separate test-utils
 * folder, since it is a repository implementation itself — just one that
 * lives in memory — and conventions.md does not define a different
 * location for repository fakes.
 *
 * Per Spec 011 ("Per-user local data scoping"), this fake also enforces the
 * `firebaseUid` filter on every method, so Feature Service tests exercise
 * real scoping behavior rather than a no-op fake that would mask
 * regressions against the real (now-scoped) `BoxSqliteRepository`.
 */
export class BoxFakeRepository implements BoxRepository {
  private readonly boxes = new Map<string, LocalBox & { firebaseUid: string }>();

  async create(box: LocalBox, firebaseUid: string): Promise<LocalBox> {
    const now = new Date().toISOString();
    const toInsert: LocalBox = { ...box, createdAt: now, updatedAt: now };
    this.boxes.set(toInsert.id, { ...toInsert, firebaseUid });
    return { ...toInsert };
  }

  async findById(id: string, firebaseUid: string): Promise<LocalBox | null> {
    const box = this.boxes.get(id);
    if (!box || box.firebaseUid !== firebaseUid) {
      return null;
    }
    const { firebaseUid: _uid, ...rest } = box;
    return { ...rest };
  }

  async findAll(
    firebaseUid: string,
    options: { includeArchived?: boolean; includeDeleted?: boolean } = {}
  ): Promise<LocalBox[]> {
    const { includeArchived = false, includeDeleted = false } = options;
    return [...this.boxes.values()]
      .filter((box) => box.firebaseUid === firebaseUid)
      .filter((box) => includeDeleted || !box.deletedAt)
      .filter((box) => includeArchived || box.status !== 'archived')
      .map(({ firebaseUid: _uid, ...rest }) => ({ ...rest }));
  }

  async update(
    id: string,
    changes: Partial<Omit<LocalBox, 'id' | 'createdAt'>>,
    firebaseUid: string
  ): Promise<LocalBox> {
    const existing = this.boxes.get(id);
    if (!existing || existing.firebaseUid !== firebaseUid) {
      throw new Error(`Box not found: ${id}`);
    }

    const updated: LocalBox & { firebaseUid: string } = {
      ...existing,
      ...changes,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      firebaseUid,
    };
    this.boxes.set(id, updated);
    const { firebaseUid: _uid, ...rest } = updated;
    return { ...rest };
  }

  async softDelete(id: string, firebaseUid: string): Promise<void> {
    const existing = this.boxes.get(id);
    if (!existing || existing.firebaseUid !== firebaseUid) {
      throw new Error(`Box not found: ${id}`);
    }
    this.boxes.set(id, { ...existing, deletedAt: new Date().toISOString() });
  }

  async hardDelete(id: string, firebaseUid: string): Promise<void> {
    const existing = this.boxes.get(id);
    if (existing && existing.firebaseUid === firebaseUid) {
      this.boxes.delete(id);
    }
  }

  /** Test helper: clears all in-memory state between specs. */
  reset(): void {
    this.boxes.clear();
  }
}
