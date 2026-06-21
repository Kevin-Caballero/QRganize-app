import { TestBed } from '@angular/core/testing';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  ExpirationNotificationsService,
  hashItemIdToNotificationId,
} from './expiration-notifications.service';
import { LocalItemsService } from './local-items.service';
import { LocalBoxesService } from './local-boxes.service';
import { AuthGateService } from './auth-gate.service';
import { ITEM_REPOSITORY } from '../repositories/item.repository.interface';
import { ItemFakeRepository } from '../repositories/item-fake.repository';
import { BOX_REPOSITORY } from '../repositories/box.repository.interface';
import { BoxFakeRepository } from '../repositories/box-fake.repository';
import { AUTH_REPOSITORY } from '../repositories/auth.repository.interface';
import { AuthFakeRepository } from '../repositories/auth-fake.repository';
import { ItemStatus, LocalItem } from '../models/local-item';
import { BoxStatus, LocalBox } from '../models/local-box';

/**
 * Unit tests for `ExpirationNotificationsService` (Spec 017). Per
 * docs/verification.md's per-layer testing approach, this is a Feature
 * Service test: it runs against `ItemFakeRepository`/`BoxFakeRepository`
 * (no real SQLite) and against a spied/stubbed `LocalNotifications`
 * plugin (no real native notifications), not against the real
 * `@capacitor/local-notifications` implementation.
 */
describe('ExpirationNotificationsService', () => {
  let service: ExpirationNotificationsService;
  let localItemsService: LocalItemsService;
  let localBoxesService: LocalBoxesService;
  let fakeAuthRepository: AuthFakeRepository;

  const CURRENT_UID = 'fake-user-a@example.com';

  beforeEach(async () => {
    fakeAuthRepository = new AuthFakeRepository();

    TestBed.configureTestingModule({
      providers: [
        ExpirationNotificationsService,
        LocalItemsService,
        LocalBoxesService,
        AuthGateService,
        { provide: ITEM_REPOSITORY, useClass: ItemFakeRepository },
        { provide: BOX_REPOSITORY, useClass: BoxFakeRepository },
        { provide: AUTH_REPOSITORY, useValue: fakeAuthRepository },
      ],
    });

    service = TestBed.inject(ExpirationNotificationsService);
    localItemsService = TestBed.inject(LocalItemsService);
    localBoxesService = TestBed.inject(LocalBoxesService);
    await fakeAuthRepository.signUpWithEmail('user-a@example.com', 'pw12345');

    spyOn(LocalNotifications, 'schedule').and.resolveTo();
    spyOn(LocalNotifications, 'cancel').and.resolveTo();
    spyOn(LocalNotifications, 'getPending').and.resolveTo({
      notifications: [],
    });
    spyOn(LocalNotifications, 'requestPermissions').and.resolveTo({
      display: 'granted',
    } as any);
    spyOn(LocalNotifications, 'checkPermissions').and.resolveTo({
      display: 'granted',
    } as any);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('hashItemIdToNotificationId', () => {
    it('is deterministic for the same id', () => {
      const id = 'some-uuid-1234';
      expect(hashItemIdToNotificationId(id)).toBe(
        hashItemIdToNotificationId(id)
      );
    });

    it('produces a positive 31-bit integer', () => {
      const hash = hashItemIdToNotificationId('another-uuid-5678');
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0x7fffffff);
      expect(Number.isInteger(hash)).toBe(true);
    });

    it('differs for different ids (no trivial collision for these inputs)', () => {
      expect(hashItemIdToNotificationId('id-a')).not.toBe(
        hashItemIdToNotificationId('id-b')
      );
    });
  });

  const baseItem: Omit<
    LocalItem,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
  > = {
    boxId: 'box-1',
    name: 'Glass cup',
    description: '',
    category: '',
    quantity: 1,
    status: ItemStatus.ACTIVE,
    imageUri: '',
  };

  function futureIso(daysFromNow: number): string {
    return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
  }

  describe('scheduleForItem', () => {
    it('schedules a notification for an item that expires in the future', async () => {
      const item: LocalItem = {
        ...baseItem,
        id: 'item-1',
        expires: true,
        expirationDate: futureIso(10),
        createdAt: '',
        updatedAt: '',
      };

      await service.scheduleForItem(item, { name: 'Kitchen box' }, 3);

      expect(LocalNotifications.schedule).toHaveBeenCalled();
      const args = (LocalNotifications.schedule as jasmine.Spy).calls.mostRecent()
        .args[0];
      expect(args.notifications[0].body).toContain('Glass cup');
      expect(args.notifications[0].body).toContain('Kitchen box');
    });

    it('does not schedule when item.expires is false', async () => {
      const item: LocalItem = {
        ...baseItem,
        id: 'item-2',
        expires: false,
        expirationDate: futureIso(10),
        createdAt: '',
        updatedAt: '',
      };

      await service.scheduleForItem(item, null, 3);

      expect(LocalNotifications.schedule).not.toHaveBeenCalled();
    });

    it('does not schedule when the reminder time is already in the past', async () => {
      const item: LocalItem = {
        ...baseItem,
        id: 'item-3',
        expires: true,
        expirationDate: futureIso(1), // 1 day out, but reminderDays=3 puts "at" in the past
        createdAt: '',
        updatedAt: '',
      };

      await service.scheduleForItem(item, null, 3);

      expect(LocalNotifications.schedule).not.toHaveBeenCalled();
    });

    it('cancels any existing notification for the item id before scheduling', async () => {
      const item: LocalItem = {
        ...baseItem,
        id: 'item-4',
        expires: true,
        expirationDate: futureIso(10),
        createdAt: '',
        updatedAt: '',
      };

      await service.scheduleForItem(item, null, 3);

      expect(LocalNotifications.cancel).toHaveBeenCalled();
    });
  });

  describe('cancelForItem / cancelForItems', () => {
    it('cancels a single item notification', async () => {
      await service.cancelForItem('item-x');
      expect(LocalNotifications.cancel).toHaveBeenCalledWith({
        notifications: [{ id: hashItemIdToNotificationId('item-x') }],
      });
    });

    it('no-ops for an empty id list', async () => {
      await service.cancelForItems([]);
      expect(LocalNotifications.cancel).not.toHaveBeenCalled();
    });

    it('cancels multiple item notifications', async () => {
      await service.cancelForItems(['a', 'b']);
      expect(LocalNotifications.cancel).toHaveBeenCalledWith({
        notifications: [
          { id: hashItemIdToNotificationId('a') },
          { id: hashItemIdToNotificationId('b') },
        ],
      });
    });
  });

  describe('requestPermission / hasPermission', () => {
    it('returns true when granted', async () => {
      expect(await service.requestPermission()).toBe(true);
      expect(await service.hasPermission()).toBe(true);
    });

    it('returns false when denied', async () => {
      (LocalNotifications.requestPermissions as jasmine.Spy).and.resolveTo({
        display: 'denied',
      });
      expect(await service.requestPermission()).toBe(false);
    });
  });

  describe('rescheduleAll', () => {
    it('cancels all pending, then reschedules from current item data', async () => {
      const box: LocalBox = await localBoxesService.createBox({
        name: 'Garage',
        description: '',
        room: '',
        status: BoxStatus.ACTIVE,
        qrCode: '',
      });

      await localItemsService.createItem({
        ...baseItem,
        boxId: box.id,
        expires: true,
        expirationDate: futureIso(10),
      });

      (LocalNotifications.getPending as jasmine.Spy).and.resolveTo({
        notifications: [{ id: 999 }],
      });

      await service.rescheduleAll(3);

      expect(LocalNotifications.cancel).toHaveBeenCalled();
      expect(LocalNotifications.schedule).toHaveBeenCalled();
    });
  });

  describe('cancelAll', () => {
    it('cancels every currently pending notification', async () => {
      (LocalNotifications.getPending as jasmine.Spy).and.resolveTo({
        notifications: [{ id: 1 }, { id: 2 }],
      });

      await service.cancelAll();

      expect(LocalNotifications.cancel).toHaveBeenCalledWith({
        notifications: [{ id: 1 }, { id: 2 }],
      });
    });

    it('no-ops when nothing is pending', async () => {
      await service.cancelAll();
      expect(LocalNotifications.cancel).not.toHaveBeenCalled();
    });
  });
});
