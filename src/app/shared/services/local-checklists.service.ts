import { Inject, Injectable } from '@angular/core';
import {
  ChecklistStatus,
  LocalChecklist,
  LocalChecklistItem,
} from '../models/local-checklist';
import {
  CHECKLIST_REPOSITORY,
  ChecklistRepository,
} from '../repositories/checklist.repository.interface';
import { AuthGateService } from './auth-gate.service';

/**
 * Feature Service for local (SQLite-backed) checklists, per
 * docs/architecture.md's mandatory layering and docs/specs.md Spec 013.
 *
 * Wraps `ChecklistRepository` (Spec 005) 1:1 — no extra business logic, no
 * UI logic, no new validation beyond what `ChecklistSqliteRepository`
 * already enforces. Mirrors `LocalBoxesService` (Spec 010) and
 * `LocalItemsService` (Spec 012) exactly:
 * - DI pattern: injects the `CHECKLIST_REPOSITORY` `InjectionToken`, typed
 *   to the `ChecklistRepository` interface, rather than the concrete
 *   `ChecklistSqliteRepository` class — see
 *   `checklist.repository.interface.ts`. Production wiring
 *   (`app.module.ts`) provides this token with `ChecklistSqliteRepository`;
 *   tests provide it with `ChecklistFakeRepository`.
 * - No Page/Component consumes this service in this spec — UI wiring is
 *   deferred, same as boxes/items.
 * - No `hardDeleteChecklist`/`hardDeleteItem` exposed — hard delete stays a
 *   repository-level, test/cleanup-only operation, not part of any Feature
 *   Service's public surface.
 * - Single service for both checklists and checklist items, mirroring
 *   `ChecklistRepository`'s own single-interface shape (Spec 005's
 *   "Repository Interface decision") — not split into two services.
 *
 * Per Spec 011 ("Per-user local data scoping"), see `LocalBoxesService`'s
 * equivalent doc comment for the full rationale on resolving the current
 * `firebase_uid` fresh on every call via `AuthGateService`. This applies to
 * checklist-item methods too, even though `checklist_items` itself has no
 * `firebase_uid` column — the repository scopes those transitively via the
 * owning checklist.
 */
@Injectable({
  providedIn: 'root',
})
export class LocalChecklistsService {
  constructor(
    @Inject(CHECKLIST_REPOSITORY)
    private readonly checklistRepository: ChecklistRepository,
    private readonly authGateService: AuthGateService
  ) {}

  private async requireCurrentUid(): Promise<string> {
    const user = await this.authGateService.getCurrentUser();
    if (!user) {
      throw new Error(
        'LocalChecklistsService: no authenticated user; cannot access checklists.'
      );
    }
    return user.uid;
  }

  async createChecklist(
    data: Omit<LocalChecklist, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  ): Promise<LocalChecklist> {
    // `id`/`createdAt`/`updatedAt` are set by the repository layer; only
    // `id` must be supplied here since `ChecklistRepository.createChecklist`
    // takes a full `LocalChecklist` (per Spec 005) — `createdAt`/`updatedAt`
    // are placeholders that the repository implementation overwrites itself.
    const toCreate: LocalChecklist = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: '',
      updatedAt: '',
    };
    const firebaseUid = await this.requireCurrentUid();
    return this.checklistRepository.createChecklist(toCreate, firebaseUid);
  }

  async getChecklistById(id: string): Promise<LocalChecklist | null> {
    const firebaseUid = await this.requireCurrentUid();
    return this.checklistRepository.findChecklistById(id, firebaseUid);
  }

  async getAllChecklists(options?: {
    includeArchived?: boolean;
    includeDeleted?: boolean;
  }): Promise<LocalChecklist[]> {
    const firebaseUid = await this.requireCurrentUid();
    return this.checklistRepository.findAllChecklists(firebaseUid, options);
  }

  async updateChecklist(
    id: string,
    changes: Partial<Omit<LocalChecklist, 'id' | 'createdAt'>>
  ): Promise<LocalChecklist> {
    const firebaseUid = await this.requireCurrentUid();
    return this.checklistRepository.updateChecklist(id, changes, firebaseUid);
  }

  archiveChecklist(id: string): Promise<LocalChecklist> {
    return this.updateChecklist(id, { status: ChecklistStatus.ARCHIVED });
  }

  async deleteChecklist(id: string): Promise<void> {
    const firebaseUid = await this.requireCurrentUid();
    return this.checklistRepository.softDeleteChecklist(id, firebaseUid);
  }

  async createChecklistItem(
    data: Omit<
      LocalChecklistItem,
      'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'sortOrder'
    > & { sortOrder?: number }
  ): Promise<LocalChecklistItem> {
    // Same placeholder convention as `createChecklist`/`createBox`/
    // `createItem` — `id`/`createdAt`/`updatedAt` are overwritten by the
    // repository. `sortOrder` is passed through as-is (including when
    // omitted) so `ChecklistRepository.createItem` can apply its own
    // next-available-value assignment, per Spec 005.
    const toCreate: Omit<LocalChecklistItem, 'sortOrder'> & {
      sortOrder?: number;
    } = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: '',
      updatedAt: '',
    };
    const firebaseUid = await this.requireCurrentUid();
    return this.checklistRepository.createItem(toCreate, firebaseUid);
  }

  async getChecklistItems(
    checklistId: string,
    options?: { includeDeleted?: boolean }
  ): Promise<LocalChecklistItem[]> {
    const firebaseUid = await this.requireCurrentUid();
    return this.checklistRepository.findItemsByChecklistId(
      checklistId,
      firebaseUid,
      options
    );
  }

  async updateChecklistItem(
    id: string,
    changes: Partial<Omit<LocalChecklistItem, 'id' | 'checklistId' | 'createdAt'>>
  ): Promise<LocalChecklistItem> {
    const firebaseUid = await this.requireCurrentUid();
    return this.checklistRepository.updateItem(id, changes, firebaseUid);
  }

  async deleteChecklistItem(id: string): Promise<void> {
    const firebaseUid = await this.requireCurrentUid();
    return this.checklistRepository.softDeleteItem(id, firebaseUid);
  }

  async reorderChecklistItems(
    checklistId: string,
    orderedItemIds: string[]
  ): Promise<void> {
    const firebaseUid = await this.requireCurrentUid();
    return this.checklistRepository.reorderItems(
      checklistId,
      orderedItemIds,
      firebaseUid
    );
  }
}
