import { Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { Storage } from '@ionic/storage-angular';
import { Item, CreateItemDto } from '../models/item.interface';
import { LocalItemsService } from 'src/app/shared/services/local-items.service';
import { LocalBoxesService } from 'src/app/shared/services/local-boxes.service';
import { ExpirationNotificationsService } from 'src/app/shared/services/expiration-notifications.service';
import { ItemStatus, LocalItem } from 'src/app/shared/models/local-item';

/**
 * Home-screen-facing item service. Per docs/specs.md Spec 002/003's addendum
 * ("wiring Spec 003 to the home screen"), this no longer calls the backend
 * over HTTP — it delegates to `LocalItemsService` (the Feature Service that
 * sits on top of `ItemRepository`/SQLite, see docs/architecture.md's
 * mandatory layering). Kept as a thin adapter so the `home` screen
 * components keep their existing Observable-based API.
 */
function toItem(localItem: LocalItem): Item {
  return {
    id: localItem.id,
    name: localItem.name,
    description: localItem.description,
    imageUrl: localItem.imageUri || undefined,
    quantity: localItem.quantity,
    isFragile: localItem.isFragile,
    expires: localItem.expires,
    expirationDate: localItem.expirationDate
      ? new Date(localItem.expirationDate)
      : undefined,
    createdAt: new Date(localItem.createdAt),
  };
}

@Injectable({
  providedIn: 'root',
})
export class ItemService {
  constructor(
    private localItemsService: LocalItemsService,
    private localBoxesService: LocalBoxesService,
    private expirationNotificationsService: ExpirationNotificationsService,
    private storage: Storage
  ) {}

  /**
   * Reads the "Expiration Reminders" settings (Spec 017) directly from
   * `Storage`, the same `@ionic/storage-angular` instance/keys already used
   * by `settings.page.ts` -- per Spec 017's decision, a dedicated
   * settings-access service is not warranted for two primitive values.
   */
  private async getReminderSettings(): Promise<{
    enabled: boolean;
    reminderDays: number;
  }> {
    const enabled = (await this.storage.get('expirationReminders')) !== false;
    const reminderDaysRaw = (await this.storage.get('reminderDays')) || '3';
    const reminderDays = Number(reminderDaysRaw) || 3;
    return { enabled, reminderDays };
  }

  /**
   * Schedules (or cancels) the expiration-reminder notification for a
   * freshly created/updated item. No-ops when reminders are disabled or
   * notification permission is not currently granted -- mirrors
   * `ExpirationNotificationsService.scheduleForItem`'s own no-op rules for
   * the item-data side of the decision.
   */
  private async syncNotificationForItem(localItem: LocalItem): Promise<void> {
    const { enabled, reminderDays } = await this.getReminderSettings();
    if (!enabled) {
      await this.expirationNotificationsService.cancelForItem(localItem.id);
      return;
    }

    const hasPermission =
      await this.expirationNotificationsService.hasPermission();
    if (!hasPermission) {
      await this.expirationNotificationsService.cancelForItem(localItem.id);
      return;
    }

    const box = await this.localBoxesService.getBoxById(localItem.boxId);
    await this.expirationNotificationsService.scheduleForItem(
      localItem,
      box ? { name: box.name } : null,
      reminderDays
    );
  }

  createItem(boxId: string, data: CreateItemDto): Observable<Item> {
    return from(
      this.localItemsService.createItem({
        boxId,
        name: data.name,
        description: data.description || '',
        category: '',
        quantity: data.quantity ?? 1,
        status: ItemStatus.ACTIVE,
        imageUri: data.image || '',
        isFragile: data.isFragile ?? false,
        expires: data.expires ?? false,
        expirationDate: data.expirationDate
          ? new Date(data.expirationDate).toISOString()
          : undefined,
      })
    ).pipe(
      map((localItem) => {
        this.syncNotificationForItem(localItem).catch((error) =>
          console.error(
            'ItemService: failed to schedule expiration notification on create',
            error
          )
        );
        return localItem;
      }),
      map(toItem)
    );
  }

  getItemsByBox(boxId: string): Observable<Item[]> {
    return from(this.localItemsService.getItemsByBoxId(boxId)).pipe(
      map((items) => items.map(toItem))
    );
  }

  getItem(id: string): Observable<Item> {
    return from(this.localItemsService.getItemById(id)).pipe(
      map((item) => {
        if (!item) {
          throw new Error(`Item not found: ${id}`);
        }
        return toItem(item);
      })
    );
  }

  updateItem(id: string, data: Partial<CreateItemDto>): Observable<Item> {
    const changes: Partial<LocalItem> = {};
    if (data.name !== undefined) changes.name = data.name;
    if (data.description !== undefined) changes.description = data.description;
    if (data.quantity !== undefined) changes.quantity = data.quantity;
    if (data.isFragile !== undefined) changes.isFragile = data.isFragile;
    if (data.expires !== undefined) changes.expires = data.expires;
    if (data.expirationDate !== undefined) {
      changes.expirationDate = new Date(data.expirationDate).toISOString();
    }
    if (data.image !== undefined) changes.imageUri = data.image || '';

    return from(this.localItemsService.updateItem(id, changes)).pipe(
      map((localItem) => {
        this.syncNotificationForItem(localItem).catch((error) =>
          console.error(
            'ItemService: failed to reschedule expiration notification on update',
            error
          )
        );
        return localItem;
      }),
      map(toItem)
    );
  }

  deleteItem(id: string): Observable<void> {
    return from(this.localItemsService.deleteItem(id)).pipe(
      map(() => {
        this.expirationNotificationsService
          .cancelForItem(id)
          .catch((error) =>
            console.error(
              'ItemService: failed to cancel expiration notification on delete',
              error
            )
          );
      })
    );
  }
}
