import {
  LocalChecklist,
  LocalChecklistItem,
} from '../models/local-checklist';
import { ChecklistRepository } from './checklist.repository.interface';

/**
 * In-memory fake `ChecklistRepository`, with no SQLite dependency. Per
 * docs/conventions.md ("Repository interfaces get a fake/in-memory
 * implementation for testing Feature Services"), this exists so a later
 * spec's Feature Service tests can depend on a `ChecklistRepository` without
 * touching real SQLite. Not used by any production code in this spec.
 *
 * Mirrors `box-fake.repository.ts`/`item-fake.repository.ts`. Note: unlike
 * the real `ChecklistSqliteRepository`, this fake does not enforce a foreign
 * key from items to a `checklists` table — it has no concept of relational
 * constraints at all — since FK enforcement is a storage-layer concern out
 * of scope for a Feature Service fake.
 *
 * Per Spec 011 ("Per-user local data scoping"), checklists are stamped with
 * a `firebaseUid` and every method filters by it. Checklist items have no
 * `firebaseUid` of their own (mirroring `checklist_items` having no
 * `firebase_uid` column in the real schema) — item methods are scoped
 * transitively via the owning checklist's `firebaseUid`, the same approach
 * `ChecklistSqliteRepository` takes via a join.
 */
export class ChecklistFakeRepository implements ChecklistRepository {
  private readonly checklists = new Map<
    string,
    LocalChecklist & { firebaseUid: string }
  >();
  private readonly items = new Map<string, LocalChecklistItem>();

  private assertNonEmptyTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new Error('Title must not be empty.');
    }
  }

  async createChecklist(
    checklist: LocalChecklist,
    firebaseUid: string
  ): Promise<LocalChecklist> {
    this.assertNonEmptyTitle(checklist.title);
    const now = new Date().toISOString();
    const toInsert: LocalChecklist = {
      ...checklist,
      createdAt: now,
      updatedAt: now,
    };
    this.checklists.set(toInsert.id, { ...toInsert, firebaseUid });
    return { ...toInsert };
  }

  async findChecklistById(
    id: string,
    firebaseUid: string
  ): Promise<LocalChecklist | null> {
    const checklist = this.checklists.get(id);
    if (!checklist || checklist.firebaseUid !== firebaseUid) {
      return null;
    }
    const { firebaseUid: _uid, ...rest } = checklist;
    return { ...rest };
  }

  async findAllChecklists(
    firebaseUid: string,
    options: { includeArchived?: boolean; includeDeleted?: boolean } = {}
  ): Promise<LocalChecklist[]> {
    const { includeArchived = false, includeDeleted = false } = options;
    return [...this.checklists.values()]
      .filter((checklist) => checklist.firebaseUid === firebaseUid)
      .filter((checklist) => includeDeleted || !checklist.deletedAt)
      .filter(
        (checklist) => includeArchived || checklist.status !== 'archived'
      )
      .map(({ firebaseUid: _uid, ...rest }) => ({ ...rest }));
  }

  async updateChecklist(
    id: string,
    changes: Partial<Omit<LocalChecklist, 'id' | 'createdAt'>>,
    firebaseUid: string
  ): Promise<LocalChecklist> {
    const existing = this.checklists.get(id);
    if (!existing || existing.firebaseUid !== firebaseUid) {
      throw new Error(`Checklist not found: ${id}`);
    }

    const updated: LocalChecklist & { firebaseUid: string } = {
      ...existing,
      ...changes,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      firebaseUid,
    };
    this.assertNonEmptyTitle(updated.title);
    this.checklists.set(id, updated);
    const { firebaseUid: _uid, ...rest } = updated;
    return { ...rest };
  }

  async softDeleteChecklist(id: string, firebaseUid: string): Promise<void> {
    const existing = this.checklists.get(id);
    if (!existing || existing.firebaseUid !== firebaseUid) {
      throw new Error(`Checklist not found: ${id}`);
    }
    this.checklists.set(id, {
      ...existing,
      deletedAt: new Date().toISOString(),
    });
  }

  async hardDeleteChecklist(id: string, firebaseUid: string): Promise<void> {
    const existing = this.checklists.get(id);
    if (!existing || existing.firebaseUid !== firebaseUid) {
      return;
    }
    this.checklists.delete(id);
    for (const [itemId, item] of this.items.entries()) {
      if (item.checklistId === id) {
        this.items.delete(itemId);
      }
    }
  }

  private findOwningChecklist(
    checklistId: string,
    firebaseUid: string
  ): (LocalChecklist & { firebaseUid: string }) | undefined {
    const checklist = this.checklists.get(checklistId);
    return checklist && checklist.firebaseUid === firebaseUid
      ? checklist
      : undefined;
  }

  async createItem(
    item: Omit<LocalChecklistItem, 'sortOrder'> & { sortOrder?: number },
    firebaseUid: string
  ): Promise<LocalChecklistItem> {
    this.assertNonEmptyTitle(item.title);

    if (!this.findOwningChecklist(item.checklistId, firebaseUid)) {
      throw new Error(`Checklist not found: ${item.checklistId}`);
    }

    const now = new Date().toISOString();
    const sortOrder =
      item.sortOrder !== undefined
        ? item.sortOrder
        : this.nextSortOrder(item.checklistId);

    const toInsert: LocalChecklistItem = {
      id: item.id,
      checklistId: item.checklistId,
      title: item.title,
      notes: item.notes,
      isCompleted: item.isCompleted,
      sortOrder,
      quantity: item.quantity ?? 1,
      isFragile: item.isFragile ?? false,
      expires: item.expires ?? false,
      createdAt: now,
      updatedAt: now,
    };
    if (item.expirationDate !== undefined) {
      toInsert.expirationDate = item.expirationDate;
    }
    if (item.imageUri !== undefined) {
      toInsert.imageUri = item.imageUri;
    }
    if (item.deletedAt !== undefined) {
      toInsert.deletedAt = item.deletedAt;
    }

    this.items.set(toInsert.id, toInsert);
    return { ...toInsert };
  }

  async findItemsByChecklistId(
    checklistId: string,
    firebaseUid: string,
    options: { includeDeleted?: boolean } = {}
  ): Promise<LocalChecklistItem[]> {
    if (!this.findOwningChecklist(checklistId, firebaseUid)) {
      return [];
    }
    const { includeDeleted = false } = options;
    return [...this.items.values()]
      .filter((item) => item.checklistId === checklistId)
      .filter((item) => includeDeleted || !item.deletedAt)
      .map((item) => ({ ...item }));
  }

  async updateItem(
    id: string,
    changes: Partial<
      Omit<LocalChecklistItem, 'id' | 'checklistId' | 'createdAt'>
    >,
    firebaseUid: string
  ): Promise<LocalChecklistItem> {
    const existing = this.items.get(id);
    if (
      !existing ||
      !this.findOwningChecklist(existing.checklistId, firebaseUid)
    ) {
      throw new Error(`Checklist item not found: ${id}`);
    }

    const updated: LocalChecklistItem = {
      ...existing,
      ...changes,
      id: existing.id,
      checklistId: existing.checklistId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.assertNonEmptyTitle(updated.title);
    this.items.set(id, updated);
    return { ...updated };
  }

  async softDeleteItem(id: string, firebaseUid: string): Promise<void> {
    const existing = this.items.get(id);
    if (
      !existing ||
      !this.findOwningChecklist(existing.checklistId, firebaseUid)
    ) {
      throw new Error(`Checklist item not found: ${id}`);
    }
    this.items.set(id, { ...existing, deletedAt: new Date().toISOString() });
  }

  async hardDeleteItem(id: string, firebaseUid: string): Promise<void> {
    const existing = this.items.get(id);
    if (
      existing &&
      this.findOwningChecklist(existing.checklistId, firebaseUid)
    ) {
      this.items.delete(id);
    }
  }

  async reorderItems(
    checklistId: string,
    orderedItemIds: string[],
    firebaseUid: string
  ): Promise<void> {
    if (!this.findOwningChecklist(checklistId, firebaseUid)) {
      throw new Error(`Checklist not found: ${checklistId}`);
    }

    const existingForChecklist = [...this.items.values()].filter(
      (item) => item.checklistId === checklistId
    );
    const existingIds = new Set(existingForChecklist.map((item) => item.id));

    for (const id of orderedItemIds) {
      if (!existingIds.has(id)) {
        throw new Error(
          `Checklist item ${id} does not belong to checklist ${checklistId}.`
        );
      }
    }

    orderedItemIds.forEach((id, index) => {
      const existing = this.items.get(id);
      if (existing) {
        this.items.set(id, {
          ...existing,
          sortOrder: index,
          updatedAt: new Date().toISOString(),
        });
      }
    });
  }

  private nextSortOrder(checklistId: string): number {
    const items = [...this.items.values()].filter(
      (item) => item.checklistId === checklistId
    );
    if (items.length === 0) {
      return 0;
    }
    return Math.max(...items.map((item) => item.sortOrder)) + 1;
  }

  /** Test helper: clears all in-memory state between specs. */
  reset(): void {
    this.checklists.clear();
    this.items.clear();
  }
}
