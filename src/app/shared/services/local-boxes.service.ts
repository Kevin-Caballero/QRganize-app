import { Inject, Injectable } from '@angular/core';
import { BoxStatus, LocalBox } from '../models/local-box';
import {
  BOX_REPOSITORY,
  BoxRepository,
} from '../repositories/box.repository.interface';
import { AuthGateService } from './auth-gate.service';

/**
 * Feature Service for local (SQLite-backed) boxes, per
 * docs/architecture.md's mandatory layering and docs/specs.md Spec 003.
 *
 * Wraps `BoxRepository` (Spec 003) 1:1 — no extra business logic, no UI
 * logic, no new validation beyond what `BoxSqliteRepository` already
 * enforces. This is the pattern `LocalItemsService` (Spec 003) mirrors:
 * - DI pattern: injects the `BOX_REPOSITORY` `InjectionToken`, typed to the
 *   `BoxRepository` interface, rather than the concrete `BoxSqliteRepository`
 *   class — see `box.repository.interface.ts`. Production wiring
 *   (`app.module.ts`) provides this token with `BoxSqliteRepository`; tests
 *   provide it with `BoxFakeRepository`.
 * - UI wiring and the numeric-vs-UUID id mismatch with the legacy remote
 *   `Box` were resolved in Spec 003's home-screen wiring addendum.
 * - No `hardDelete` exposed — hard delete stays a repository-level,
 *   test/cleanup-only operation, not part of any Feature Service's public
 *   surface.
 *
 * Per Spec 011 ("Per-user local data scoping"), this service injects
 * `AuthGateService` and resolves the current user's `firebase_uid` fresh on
 * EVERY method call via `getCurrentUser()` — never cached once at
 * construction time — so that signing out and signing in as a different
 * user (without restarting the app) immediately scopes subsequent calls to
 * the new user. `BoxRepository` itself stays "dumb": it accepts the UID as
 * a parameter and never imports/depends on `AuthGateService` or any auth
 * concept directly, per docs/architecture.md's mandatory layering.
 */
@Injectable({
  providedIn: 'root',
})
export class LocalBoxesService {
  constructor(
    @Inject(BOX_REPOSITORY) private readonly boxRepository: BoxRepository,
    private readonly authGateService: AuthGateService
  ) {}

  /**
   * Resolves the current Firebase UID fresh on every call (Spec 011's
   * no-caching acceptance criterion). Throws rather than silently calling
   * the repository with an empty/undefined UID if there is no authenticated
   * user — this should not happen given the route guard (Spec 010), but must
   * be handled defensively rather than assumed away.
   */
  private async requireCurrentUid(): Promise<string> {
    const user = await this.authGateService.getCurrentUser();
    if (!user) {
      throw new Error(
        'LocalBoxesService: no authenticated user; cannot access boxes.'
      );
    }
    return user.uid;
  }

  async createBox(
    data: Omit<
      LocalBox,
      'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'packingStatus'
    > & { packingStatus?: LocalBox['packingStatus'] }
  ): Promise<LocalBox> {
    // `id`/`createdAt`/`updatedAt` are set by the repository layer; only
    // `id` must be supplied here since `BoxRepository.create` takes a full
    // `LocalBox` (per Spec 003) — `createdAt`/`updatedAt` are placeholders
    // that the repository implementation overwrites itself.
    // `packingStatus` defaults to `'packing'` (Spec 009) if not supplied by
    // the caller, since callers predating Spec 009 (e.g. `BoxService`) do
    // not yet know about this field.
    const toCreate: LocalBox = {
      ...data,
      packingStatus: data.packingStatus ?? 'packing',
      id: crypto.randomUUID(),
      createdAt: '',
      updatedAt: '',
    };
    const firebaseUid = await this.requireCurrentUid();
    return this.boxRepository.create(toCreate, firebaseUid);
  }

  async getBoxById(id: string): Promise<LocalBox | null> {
    const firebaseUid = await this.requireCurrentUid();
    return this.boxRepository.findById(id, firebaseUid);
  }

  async getAllBoxes(options?: {
    includeArchived?: boolean;
    includeDeleted?: boolean;
  }): Promise<LocalBox[]> {
    const firebaseUid = await this.requireCurrentUid();
    return this.boxRepository.findAll(firebaseUid, options);
  }

  async updateBox(
    id: string,
    changes: Partial<Omit<LocalBox, 'id' | 'createdAt'>>
  ): Promise<LocalBox> {
    const firebaseUid = await this.requireCurrentUid();
    return this.boxRepository.update(id, changes, firebaseUid);
  }

  archiveBox(id: string): Promise<LocalBox> {
    return this.updateBox(id, { status: BoxStatus.ARCHIVED });
  }

  /**
   * Seals a box (packing-progress lifecycle, Spec 009), independent of the
   * active/archived `status` field. Rejects if the box is already sealed.
   */
  async sealBox(id: string): Promise<LocalBox> {
    const firebaseUid = await this.requireCurrentUid();
    const existing = await this.boxRepository.findById(id, firebaseUid);
    if (!existing) {
      throw new Error(`Box not found: ${id}`);
    }
    if (existing.packingStatus === 'sealed') {
      throw new Error(`Box is already sealed: ${id}`);
    }
    return this.updateBox(id, { packingStatus: 'sealed' });
  }

  /**
   * Reopens a sealed box (packing-progress lifecycle, Spec 009), independent
   * of the active/archived `status` field. Rejects if the box is already
   * packing.
   */
  async reopenBox(id: string): Promise<LocalBox> {
    const firebaseUid = await this.requireCurrentUid();
    const existing = await this.boxRepository.findById(id, firebaseUid);
    if (!existing) {
      throw new Error(`Box not found: ${id}`);
    }
    if (existing.packingStatus === 'packing') {
      throw new Error(`Box is already packing: ${id}`);
    }
    return this.updateBox(id, { packingStatus: 'packing' });
  }

  async deleteBox(id: string): Promise<void> {
    const firebaseUid = await this.requireCurrentUid();
    return this.boxRepository.softDelete(id, firebaseUid);
  }
}
