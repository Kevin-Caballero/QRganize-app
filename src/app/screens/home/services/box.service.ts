import { Injectable } from '@angular/core';
import { forkJoin, from, map, Observable, of, switchMap } from 'rxjs';
import { Box, Item as BoxItem } from '../models/box.interface';
import { PaginationOptions } from 'src/app/shared/models/pagination-options';
import { BoxReqDto } from '../models/box-req.dto';
import { LocalBoxesService } from 'src/app/shared/services/local-boxes.service';
import { BoxStatus, LocalBox } from 'src/app/shared/models/local-box';
import { ItemService } from './item.service';
import { LocalChecklistsService } from 'src/app/shared/services/local-checklists.service';
import { LocalChecklist } from 'src/app/shared/models/local-checklist';
import { ExpirationNotificationsService } from 'src/app/shared/services/expiration-notifications.service';

/**
 * Home-screen-facing box service. Per docs/specs.md Spec 002/003's addendum
 * ("wiring Spec 003 to the home screen"), this no longer calls the backend
 * over HTTP — it delegates to `LocalBoxesService` (the Feature Service that
 * sits on top of `BoxRepository`/SQLite, see docs/architecture.md's mandatory
 * layering). This class stays as a thin adapter so `BoxStateService` and the
 * rest of the `home` screen keep working against the same `Box` view-model
 * shape/Observable API they already use, instead of every consumer needing
 * to be rewritten to `LocalBox`/Promises directly.
 */
function toBox(localBox: LocalBox): Box {
  return {
    id: localBox.id,
    name: localBox.name,
    description: localBox.description,
    imageUrl: localBox.imageUri ?? '',
    qrCode: localBox.qrCode,
    createdAt: localBox.createdAt,
    updatedAt: localBox.updatedAt,
    packingStatus: localBox.packingStatus,
    room: localBox.room,
  };
}

@Injectable({
  providedIn: 'root',
})
export class BoxService {
  constructor(
    private localBoxesService: LocalBoxesService,
    private itemService: ItemService,
    private localChecklistsService: LocalChecklistsService,
    private expirationNotificationsService: ExpirationNotificationsService
  ) {}

  createBox(data: BoxReqDto): Observable<Box> {
    return from(this.createBoxWithQrCode(data)).pipe(map(toBox));
  }

  private async createBoxWithQrCode(data: BoxReqDto): Promise<LocalBox> {
    const created = await this.localBoxesService.createBox({
      name: data.name,
      description: data.description,
      room: data.room ?? '',
      status: BoxStatus.ACTIVE,
      qrCode: '', // set below once the id is known
      imageUri: data.image || undefined,
      ...(data.packingStatus !== undefined
        ? { packingStatus: data.packingStatus }
        : {}),
    });

    // The QR payload (see docs/specs.md Spec 002/003: `qrganize:box:<id>`)
    // depends on the generated id, so it is set in a follow-up update.
    const box = await this.localBoxesService.updateBox(created.id, {
      qrCode: `qrganize:box:${created.id}`,
    });

    // Spec 014: persist the checklist selected during creation, if any.
    // Must happen after the box exists since it needs the real (generated)
    // box id. A failure here is deliberately non-fatal (see Spec 014's
    // "Failure-handling decision") — the box itself was already created
    // successfully and the assignment is recoverable later from box-detail.
    if (data.checklistId) {
      try {
        await this.localChecklistsService.updateChecklist(data.checklistId, {
          boxId: box.id,
        });
      } catch (error) {
        console.error(
          'BoxService: failed to assign checklist to newly created box',
          error
        );
      }
    }

    return box;
  }

  /**
   * Assigns an existing (currently unassigned) checklist to a box, per
   * docs/specs.md Spec 014 Fix 2. Wraps `LocalChecklistsService.updateChecklist`
   * so `box-detail.component.ts` never depends on `LocalChecklistsService`
   * directly, per docs/architecture.md's mandatory layering.
   */
  assignChecklistToBox(
    checklistId: string,
    boxId: string
  ): Observable<LocalChecklist> {
    return from(
      this.localChecklistsService.updateChecklist(checklistId, { boxId })
    );
  }

  /**
   * Clears a checklist's box assignment (Spec 014, optional unassign action).
   */
  unassignChecklist(checklistId: string): Observable<LocalChecklist> {
    return from(
      this.localChecklistsService.updateChecklist(checklistId, {
        boxId: undefined,
      })
    );
  }

  /**
   * Lists checklists not currently assigned to any box (Spec 014), reusing
   * the same `!checklist.boxId` filter already proven in
   * `box-modal.component.ts`'s `loadAvailableChecklists()`.
   */
  getUnassignedChecklists(): Observable<LocalChecklist[]> {
    return from(this.localChecklistsService.getAllChecklists()).pipe(
      map((checklists) => checklists.filter((checklist) => !checklist.boxId))
    );
  }

  getBoxes(
    paginationOptions: PaginationOptions = { page: 1, size: 20 }
  ): Observable<[Box[], number]> {
    return from(this.localBoxesService.getAllBoxes()).pipe(
      map((boxes) => {
        const mapped = boxes.map(toBox);
        return [mapped, mapped.length] as [Box[], number];
      })
    );
  }

  /**
   * Deletes (soft-deletes) a box. Per Spec 017's Problem section, box
   * soft-delete does NOT cascade through `ItemService`/`LocalItemsService`,
   * so this must explicitly cancel any pending expiration-reminder
   * notifications for the box's items first -- otherwise they would be
   * orphaned (firing for an item whose box the user considers deleted).
   */
  deleteBox(box: Box): Observable<void> {
    return this.itemService.getItemsByBox(box.id).pipe(
      switchMap((items) => {
        const itemIds = items.map((item) => item.id);
        return from(
          this.expirationNotificationsService
            .cancelForItems(itemIds)
            .catch((error) =>
              console.error(
                'BoxService: failed to cancel expiration notifications for deleted box items',
                error
              )
            )
        );
      }),
      switchMap(() => from(this.localBoxesService.deleteBox(box.id)))
    );
  }

  /**
   * Searches boxes by name/description, OR by any of their items'
   * name/description (Spec 013). Every returned `Box` has `items` populated
   * (mirroring `box-list.component.ts`'s `forkJoin`-over-`getItemsByBox`
   * pattern), so `search.page.ts`'s existing `getMatchingItems()`/
   * `hasMatchingItems()` logic has real data to render "Found in items: ...".
   */
  searchBoxes(term: string): Observable<Box[]> {
    const lowerTerm = term.toLowerCase();

    return from(this.localBoxesService.getAllBoxes()).pipe(
      switchMap((boxes) => {
        if (boxes.length === 0) {
          return of([] as Box[]);
        }

        const itemRequests = boxes.map((box) =>
          this.itemService.getItemsByBox(box.id)
        );

        return forkJoin(itemRequests).pipe(
          map((itemsPerBox) => {
            const candidates = boxes.map((box, index) => ({
              box: toBox(box),
              items: itemsPerBox[index],
            }));

            return candidates
              .filter(({ box, items }) => {
                const boxMatches =
                  box.name.toLowerCase().includes(lowerTerm) ||
                  (box.description ?? '').toLowerCase().includes(lowerTerm);
                const itemMatches = items.some(
                  (item) =>
                    item.name.toLowerCase().includes(lowerTerm) ||
                    (item.description ?? '')
                      .toLowerCase()
                      .includes(lowerTerm)
                );
                return boxMatches || itemMatches;
              })
              .map(({ box, items }) => ({
                ...box,
                items: items.map(
                  (item): BoxItem => ({
                    id: item.id,
                    name: item.name,
                    description: item.description,
                    imageUrl: item.imageUrl,
                    quantity: item.quantity,
                    isFragile: item.isFragile,
                    createdAt: item.createdAt
                      ? item.createdAt.toISOString()
                      : undefined,
                  })
                ),
              }));
          })
        );
      })
    );
  }

  updateBox(boxId: string, data: Partial<BoxReqDto>): Observable<Box> {
    const changes: Partial<LocalBox> = {};
    if (data.name !== undefined) changes.name = data.name;
    if (data.description !== undefined) changes.description = data.description;
    if (data.image) changes.imageUri = data.image;
    if (data.room !== undefined) changes.room = data.room;

    return from(this.localBoxesService.updateBox(boxId, changes)).pipe(
      map(toBox)
    );
  }

  getAvailableForChecklist(): Observable<Box[]> {
    return from(this.localBoxesService.getAllBoxes()).pipe(
      map((boxes) => boxes.map(toBox))
    );
  }

  /**
   * Seals a box (Spec 009 Step 5), delegating to `LocalBoxesService.sealBox`.
   * `box-detail.component.ts` must call this rather than `LocalBoxesService`
   * directly, per `docs/architecture.md`'s mandatory layering.
   */
  sealBox(boxId: string): Observable<Box> {
    return from(this.localBoxesService.sealBox(boxId)).pipe(map(toBox));
  }

  /**
   * Reopens a sealed box (Spec 009 Step 5), delegating to
   * `LocalBoxesService.reopenBox`.
   */
  reopenBox(boxId: string): Observable<Box> {
    return from(this.localBoxesService.reopenBox(boxId)).pipe(map(toBox));
  }
}
