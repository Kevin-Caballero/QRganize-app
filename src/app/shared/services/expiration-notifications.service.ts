import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { LocalItem } from '../models/local-item';
import { LocalItemsService } from './local-items.service';
import { LocalBoxesService } from './local-boxes.service';

/**
 * Deterministic string -> 31-bit positive integer hash, used to derive a
 * `@capacitor/local-notifications` notification id from a `LocalItem.id`
 * (a `crypto.randomUUID()` string; the plugin requires a 32-bit integer
 * id). Implementation: 32-bit FNV-1a.
 *
 * Algorithm (do not change without also handling the "orphaned pending
 * notifications until the next rescheduleAll()" consequence described in
 * docs/specs.md Spec 017's Technical approach):
 * 1. Start with the FNV-1a 32-bit offset basis `0x811c9dc5`.
 * 2. For each UTF-16 code unit of the string, XOR it into the hash, then
 *    multiply by the FNV prime `0x01000193`, keeping only the low 32 bits.
 * 3. Mask the final 32-bit value with `0x7fffffff` to force it positive
 *    (clears the sign bit), since the plugin expects a positive integer.
 *
 * Collisions are accepted as a known, documented risk at this app's
 * expected (single-household) item-count scale -- see Spec 017's Risks.
 */
export function hashItemIdToNotificationId(itemId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < itemId.length; i++) {
    hash ^= itemId.charCodeAt(i);
    // 32-bit FNV prime multiplication, kept within 32 bits via Math.imul.
    hash = Math.imul(hash, 0x01000193);
  }
  // Force unsigned 32-bit, then mask off the sign bit to stay in the
  // positive 31-bit range the plugin expects.
  return (hash >>> 0) & 0x7fffffff;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Feature Service wrapping `@capacitor/local-notifications` for
 * expiration-reminder notifications (Spec 017). This is the **only** thing
 * in the app allowed to call the `LocalNotifications` plugin, mirroring how
 * `SqliteService` is the only thing allowed to call the SQLite plugin (see
 * docs/architecture.md's mandatory layering for the data-access equivalent
 * of this boundary).
 *
 * Allowed to depend on `LocalItemsService`/`LocalBoxesService` (read-only)
 * to resolve item/box data for notification text and for `rescheduleAll()`
 * -- both already-existing Feature Services, so this does not introduce a
 * new SQLite access path.
 */
@Injectable({
  providedIn: 'root',
})
export class ExpirationNotificationsService {
  constructor(
    private readonly localItemsService: LocalItemsService,
    private readonly localBoxesService: LocalBoxesService
  ) {}

  /**
   * Requests the OS notification permission (Android 13+; no-op/auto-
   * granted on older versions). Returns whether permission ended up
   * granted.
   */
  async requestPermission(): Promise<boolean> {
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  }

  /** Returns whether notification permission is currently granted. */
  async hasPermission(): Promise<boolean> {
    const result = await LocalNotifications.checkPermissions();
    return result.display === 'granted';
  }

  /**
   * Schedules (or cancels, if no longer applicable) a single reminder
   * notification for `item`, `reminderDays` days before its
   * `expirationDate`. No-ops if the item does not expire, has no
   * expiration date, or the computed reminder time is already in the past.
   * Always cancels any existing notification for this item id first, so
   * there is never more than one pending notification per item.
   */
  async scheduleForItem(
    item: LocalItem,
    box: { name: string } | null,
    reminderDays: number
  ): Promise<void> {
    await this.cancelForItem(item.id);

    if (!item.expires || !item.expirationDate) {
      return;
    }

    const expirationTime = new Date(item.expirationDate).getTime();
    if (Number.isNaN(expirationTime)) {
      return;
    }

    const at = new Date(expirationTime - reminderDays * MS_PER_DAY);
    if (at.getTime() <= Date.now()) {
      return;
    }

    const body = box
      ? `${item.name} (in ${box.name}) expires soon`
      : `${item.name} expires soon`;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: hashItemIdToNotificationId(item.id),
          title: 'Expiration Reminder',
          body,
          schedule: { at },
        },
      ],
    });
  }

  /** Cancels the pending reminder notification for a single item id, if any. */
  async cancelForItem(itemId: string): Promise<void> {
    await this.cancelForItems([itemId]);
  }

  /**
   * Cancels pending reminder notifications for multiple item ids. Used by
   * `BoxService.deleteBox()` since box soft-delete does not cascade through
   * `ItemService`/`LocalItemsService`.
   */
  async cancelForItems(itemIds: string[]): Promise<void> {
    if (itemIds.length === 0) {
      return;
    }
    await LocalNotifications.cancel({
      notifications: itemIds.map((id) => ({
        id: hashItemIdToNotificationId(id),
      })),
    });
  }

  /** Cancels every currently pending notification scheduled by this service. */
  async cancelAll(): Promise<void> {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length === 0) {
      return;
    }
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    });
  }

  /**
   * Reads all items (across all boxes), cancels every currently pending
   * reminder notification, then reschedules from current item data using
   * `reminderDays`. Used by: app startup reconciliation, `reminderDays`
   * changes, and re-enabling the "Expiration Reminders" toggle.
   */
  async rescheduleAll(reminderDays: number): Promise<void> {
    await this.cancelAll();

    const items = await this.localItemsService.getAllItems();
    const boxes = await this.localBoxesService.getAllBoxes();
    const boxesById = new Map(boxes.map((box) => [box.id, box]));

    for (const item of items) {
      const box = boxesById.get(item.boxId) ?? null;
      await this.scheduleForItem(item, box, reminderDays);
    }
  }
}
