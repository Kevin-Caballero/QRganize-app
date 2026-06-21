import { Inject, Injectable } from '@angular/core';
import { ItemStatus, LocalItem } from '../models/local-item';
import {
  ITEM_REPOSITORY,
  ItemRepository,
} from '../repositories/item.repository.interface';
import { AuthGateService } from './auth-gate.service';

/**
 * Feature Service for local (SQLite-backed) items, per
 * docs/architecture.md's mandatory layering and docs/specs.md Spec 003.
 *
 * Wraps `ItemRepository` (Spec 003) 1:1 — no extra business logic, no UI
 * logic, no new validation beyond what `ItemSqliteRepository` already
 * enforces. Mirrors `LocalBoxesService` (Spec 003) exactly:
 * - DI pattern: injects the `ITEM_REPOSITORY` `InjectionToken`, typed to the
 *   `ItemRepository` interface, rather than the concrete
 *   `ItemSqliteRepository` class — see `item.repository.interface.ts`.
 *   Production wiring (`app.module.ts`) provides this token with
 *   `ItemSqliteRepository`; tests provide it with `ItemFakeRepository`.
 * - No Page/Component consumes this service in this spec.
 * - No `hardDelete` exposed — hard delete stays a repository-level,
 *   test/cleanup-only operation, not part of any Feature Service's public
 *   surface.
 *
 * Per Spec 011 ("Per-user local data scoping"), see `LocalBoxesService`'s
 * equivalent doc comment for the full rationale on resolving the current
 * `firebase_uid` fresh on every call via `AuthGateService`.
 */
@Injectable({
  providedIn: 'root',
})
export class LocalItemsService {
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly itemRepository: ItemRepository,
    private readonly authGateService: AuthGateService
  ) {}

  private async requireCurrentUid(): Promise<string> {
    const user = await this.authGateService.getCurrentUser();
    if (!user) {
      throw new Error(
        'LocalItemsService: no authenticated user; cannot access items.'
      );
    }
    return user.uid;
  }

  async createItem(
    data: Omit<LocalItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  ): Promise<LocalItem> {
    // `id`/`createdAt`/`updatedAt` are set by the repository layer; only
    // `id` must be supplied here since `ItemRepository.create` takes a full
    // `LocalItem` (per Spec 004) — `createdAt`/`updatedAt` are placeholders
    // that the repository implementation overwrites itself.
    const toCreate: LocalItem = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: '',
      updatedAt: '',
    };
    const firebaseUid = await this.requireCurrentUid();
    return this.itemRepository.create(toCreate, firebaseUid);
  }

  async getItemById(id: string): Promise<LocalItem | null> {
    const firebaseUid = await this.requireCurrentUid();
    return this.itemRepository.findById(id, firebaseUid);
  }

  async getItemsByBoxId(
    boxId: string,
    options?: { includeArchived?: boolean; includeDeleted?: boolean }
  ): Promise<LocalItem[]> {
    const firebaseUid = await this.requireCurrentUid();
    return this.itemRepository.findByBoxId(boxId, firebaseUid, options);
  }

  async getAllItems(options?: {
    includeArchived?: boolean;
    includeDeleted?: boolean;
  }): Promise<LocalItem[]> {
    const firebaseUid = await this.requireCurrentUid();
    return this.itemRepository.findAll(firebaseUid, options);
  }

  async updateItem(
    id: string,
    changes: Partial<Omit<LocalItem, 'id' | 'boxId' | 'createdAt'>>
  ): Promise<LocalItem> {
    const firebaseUid = await this.requireCurrentUid();
    return this.itemRepository.update(id, changes, firebaseUid);
  }

  archiveItem(id: string): Promise<LocalItem> {
    return this.updateItem(id, { status: ItemStatus.ARCHIVED });
  }

  async deleteItem(id: string): Promise<void> {
    const firebaseUid = await this.requireCurrentUid();
    return this.itemRepository.softDelete(id, firebaseUid);
  }
}
