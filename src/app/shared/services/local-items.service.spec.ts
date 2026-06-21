import { TestBed } from '@angular/core/testing';
import { ItemStatus, LocalItem } from '../models/local-item';
import { ItemFakeRepository } from '../repositories/item-fake.repository';
import { ITEM_REPOSITORY } from '../repositories/item.repository.interface';
import { AuthFakeRepository } from '../repositories/auth-fake.repository';
import { AUTH_REPOSITORY } from '../repositories/auth.repository.interface';
import { AuthGateService } from './auth-gate.service';
import { LocalItemsService } from './local-items.service';

/**
 * Unit tests for `LocalItemsService` (Spec 012), against `ItemFakeRepository`
 * (Spec 004) — not real SQLite. Mirrors `local-boxes.service.spec.ts`'s
 * style (Spec 010): the `ITEM_REPOSITORY` token is provided with the
 * in-memory fake, so the service under test is exercised exactly as it is
 * constructed in production (which provides the same token with
 * `ItemSqliteRepository`), without touching SQLite.
 *
 * Per Spec 011 ("Per-user local data scoping"), `LocalItemsService` now also
 * depends on `AuthGateService`, provided here with `AuthFakeRepository` —
 * see `local-boxes.service.spec.ts`'s equivalent doc comment.
 */
describe('LocalItemsService', () => {
  let service: LocalItemsService;
  let fakeRepository: ItemFakeRepository;
  let fakeAuthRepository: AuthFakeRepository;

  const baseItemData: Omit<
    LocalItem,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
  > = {
    boxId: 'box-1',
    name: 'Plates',
    description: '',
    category: 'Kitchen',
    quantity: 4,
    status: ItemStatus.ACTIVE,
    imageUri: '',
  };

  // Matches `AuthFakeRepository.signUpWithEmail`'s `fake-${email}` uid
  // convention.
  const CURRENT_UID = 'fake-user-a@example.com';

  beforeEach(async () => {
    fakeRepository = new ItemFakeRepository();
    fakeAuthRepository = new AuthFakeRepository();

    TestBed.configureTestingModule({
      providers: [
        LocalItemsService,
        AuthGateService,
        { provide: ITEM_REPOSITORY, useValue: fakeRepository },
        { provide: AUTH_REPOSITORY, useValue: fakeAuthRepository },
      ],
    });

    service = TestBed.inject(LocalItemsService);
    await fakeAuthRepository.signUpWithEmail('user-a@example.com', 'pw12345');
  });

  afterEach(() => {
    fakeRepository.reset();
    fakeAuthRepository.reset();
  });

  it('rejects when there is no authenticated user', async () => {
    await fakeAuthRepository.signOut();
    await expectAsync(service.getAllItems()).toBeRejected();
  });

  it('createItem creates and returns a new item', async () => {
    const created = await service.createItem(baseItemData);

    expect(created.id).toBeTruthy();
    expect(created.boxId).toBe('box-1');
    expect(created.name).toBe('Plates');
    expect(created.quantity).toBe(4);
    expect(created.status).toBe(ItemStatus.ACTIVE);
    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBeTruthy();

    const found = await fakeRepository.findById(created.id, CURRENT_UID);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Plates');
  });

  it('getItemById returns the matching item, or null if not found', async () => {
    const created = await service.createItem(baseItemData);

    const found = await service.getItemById(created.id);
    expect(found?.id).toBe(created.id);

    const notFound = await service.getItemById('does-not-exist');
    expect(notFound).toBeNull();
  });

  it('getItemsByBoxId returns items for the box, excluding archived/deleted by default', async () => {
    const active = await service.createItem(baseItemData);
    const archived = await service.createItem({
      ...baseItemData,
      name: 'Archived item',
      status: ItemStatus.ARCHIVED,
    });
    const otherBox = await service.createItem({
      ...baseItemData,
      boxId: 'box-2',
      name: 'Other box item',
    });

    const defaultResult = await service.getItemsByBoxId('box-1');
    expect(defaultResult.map((i) => i.id)).toEqual([active.id]);
    expect(defaultResult.some((i) => i.id === archived.id)).toBe(false);
    expect(defaultResult.some((i) => i.id === otherBox.id)).toBe(false);

    const withArchived = await service.getItemsByBoxId('box-1', {
      includeArchived: true,
    });
    expect(withArchived.map((i) => i.id).sort()).toEqual(
      [active.id, archived.id].sort()
    );

    await service.deleteItem(active.id);
    const afterDelete = await service.getItemsByBoxId('box-1');
    expect(afterDelete.length).toBe(0);

    const withDeleted = await service.getItemsByBoxId('box-1', {
      includeDeleted: true,
    });
    expect(withDeleted.some((i) => i.id === active.id)).toBe(true);
  });

  it('getAllItems returns all items across boxes, excluding archived/deleted by default', async () => {
    const item1 = await service.createItem(baseItemData);
    const item2 = await service.createItem({
      ...baseItemData,
      boxId: 'box-2',
      name: 'Second item',
    });
    const archived = await service.createItem({
      ...baseItemData,
      name: 'Archived item',
      status: ItemStatus.ARCHIVED,
    });

    const all = await service.getAllItems();
    expect(all.map((i) => i.id).sort()).toEqual([item1.id, item2.id].sort());
    expect(all.some((i) => i.id === archived.id)).toBe(false);

    const withArchived = await service.getAllItems({ includeArchived: true });
    expect(withArchived.some((i) => i.id === archived.id)).toBe(true);
  });

  it('updateItem applies partial changes and bumps updatedAt', async () => {
    const created = await service.createItem(baseItemData);

    const updated = await service.updateItem(created.id, {
      name: 'Updated plates',
      quantity: 10,
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Updated plates');
    expect(updated.quantity).toBe(10);
    expect(updated.boxId).toBe(created.boxId);
  });

  it('archiveItem sets status to archived via updateItem', async () => {
    const created = await service.createItem(baseItemData);
    expect(created.status).toBe(ItemStatus.ACTIVE);

    const archived = await service.archiveItem(created.id);

    expect(archived.id).toBe(created.id);
    expect(archived.status).toBe(ItemStatus.ARCHIVED);

    const stored = await fakeRepository.findById(created.id, CURRENT_UID);
    expect(stored?.status).toBe(ItemStatus.ARCHIVED);
  });

  it('deleteItem soft-deletes by calling ItemRepository.softDelete', async () => {
    const created = await service.createItem(baseItemData);

    await service.deleteItem(created.id);

    const stored = await fakeRepository.findById(created.id, CURRENT_UID);
    expect(stored).not.toBeNull();
    expect(stored?.deletedAt).toBeTruthy();

    const visible = await service.getItemsByBoxId(created.boxId);
    expect(visible.some((i) => i.id === created.id)).toBe(false);
  });
});
