import { TestBed } from '@angular/core/testing';
import { ChecklistStatus, LocalChecklist } from '../models/local-checklist';
import { ChecklistFakeRepository } from '../repositories/checklist-fake.repository';
import { CHECKLIST_REPOSITORY } from '../repositories/checklist.repository.interface';
import { AuthFakeRepository } from '../repositories/auth-fake.repository';
import { AUTH_REPOSITORY } from '../repositories/auth.repository.interface';
import { AuthGateService } from './auth-gate.service';
import { LocalChecklistsService } from './local-checklists.service';

/**
 * Unit tests for `LocalChecklistsService` (Spec 013), against
 * `ChecklistFakeRepository` (Spec 005) — not real SQLite. Mirrors
 * `local-boxes.service.spec.ts`/`local-items.service.spec.ts`'s style
 * (Specs 010/012): the `CHECKLIST_REPOSITORY` token is provided with the
 * in-memory fake, so the service under test is exercised exactly as it is
 * constructed in production (which provides the same token with
 * `ChecklistSqliteRepository`), without touching SQLite.
 *
 * Per Spec 011 ("Per-user local data scoping"), `LocalChecklistsService` now
 * also depends on `AuthGateService`, provided here with
 * `AuthFakeRepository` — see `local-boxes.service.spec.ts`'s equivalent doc
 * comment.
 */
describe('LocalChecklistsService', () => {
  let service: LocalChecklistsService;
  let fakeRepository: ChecklistFakeRepository;
  let fakeAuthRepository: AuthFakeRepository;

  const baseChecklistData: Omit<
    LocalChecklist,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
  > = {
    title: 'Moving checklist',
    description: '',
    status: ChecklistStatus.ACTIVE,
  };

  // Matches `AuthFakeRepository.signUpWithEmail`'s `fake-${email}` uid
  // convention.
  const CURRENT_UID = 'fake-user-a@example.com';

  beforeEach(async () => {
    fakeRepository = new ChecklistFakeRepository();
    fakeAuthRepository = new AuthFakeRepository();

    TestBed.configureTestingModule({
      providers: [
        LocalChecklistsService,
        AuthGateService,
        { provide: CHECKLIST_REPOSITORY, useValue: fakeRepository },
        { provide: AUTH_REPOSITORY, useValue: fakeAuthRepository },
      ],
    });

    service = TestBed.inject(LocalChecklistsService);
    await fakeAuthRepository.signUpWithEmail('user-a@example.com', 'pw12345');
  });

  afterEach(() => {
    fakeRepository.reset();
    fakeAuthRepository.reset();
  });

  it('rejects when there is no authenticated user', async () => {
    await fakeAuthRepository.signOut();
    await expectAsync(service.getAllChecklists()).toBeRejected();
  });

  it('createChecklist creates and returns a new checklist', async () => {
    const created = await service.createChecklist(baseChecklistData);

    expect(created.id).toBeTruthy();
    expect(created.title).toBe('Moving checklist');
    expect(created.status).toBe(ChecklistStatus.ACTIVE);
    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBeTruthy();

    const found = await fakeRepository.findChecklistById(created.id, CURRENT_UID);
    expect(found).not.toBeNull();
    expect(found?.title).toBe('Moving checklist');
  });

  it('getChecklistById returns the matching checklist, or null if not found', async () => {
    const created = await service.createChecklist(baseChecklistData);

    const found = await service.getChecklistById(created.id);
    expect(found?.id).toBe(created.id);

    const notFound = await service.getChecklistById('does-not-exist');
    expect(notFound).toBeNull();
  });

  it('getAllChecklists returns all checklists, excluding archived/deleted by default', async () => {
    const active = await service.createChecklist(baseChecklistData);
    const archived = await service.createChecklist({
      ...baseChecklistData,
      title: 'Archived checklist',
      status: ChecklistStatus.ARCHIVED,
    });

    const defaultResult = await service.getAllChecklists();
    expect(defaultResult.map((c) => c.id)).toEqual([active.id]);
    expect(defaultResult.some((c) => c.id === archived.id)).toBe(false);

    const withArchived = await service.getAllChecklists({
      includeArchived: true,
    });
    expect(withArchived.map((c) => c.id).sort()).toEqual(
      [active.id, archived.id].sort()
    );

    await service.deleteChecklist(active.id);
    const afterDelete = await service.getAllChecklists();
    expect(afterDelete.length).toBe(0);

    const withDeleted = await service.getAllChecklists({
      includeDeleted: true,
    });
    expect(withDeleted.some((c) => c.id === active.id)).toBe(true);
  });

  it('updateChecklist applies partial changes and bumps updatedAt', async () => {
    const created = await service.createChecklist(baseChecklistData);

    const updated = await service.updateChecklist(created.id, {
      title: 'Updated checklist',
      description: 'New description',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.title).toBe('Updated checklist');
    expect(updated.description).toBe('New description');
  });

  it('archiveChecklist sets status to archived via updateChecklist', async () => {
    const created = await service.createChecklist(baseChecklistData);
    expect(created.status).toBe(ChecklistStatus.ACTIVE);

    const archived = await service.archiveChecklist(created.id);

    expect(archived.id).toBe(created.id);
    expect(archived.status).toBe(ChecklistStatus.ARCHIVED);

    const stored = await fakeRepository.findChecklistById(created.id, CURRENT_UID);
    expect(stored?.status).toBe(ChecklistStatus.ARCHIVED);
  });

  it('deleteChecklist soft-deletes by calling ChecklistRepository.softDeleteChecklist', async () => {
    const created = await service.createChecklist(baseChecklistData);

    await service.deleteChecklist(created.id);

    const stored = await fakeRepository.findChecklistById(created.id, CURRENT_UID);
    expect(stored).not.toBeNull();
    expect(stored?.deletedAt).toBeTruthy();

    const visible = await service.getAllChecklists();
    expect(visible.some((c) => c.id === created.id)).toBe(false);
  });

  it('createChecklistItem creates and returns a new item, auto-assigning sortOrder when omitted', async () => {
    const checklist = await service.createChecklist(baseChecklistData);

    const first = await service.createChecklistItem({
      checklistId: checklist.id,
      title: 'Pack kitchen boxes',
      notes: '',
      isCompleted: false,
    });
    expect(first.id).toBeTruthy();
    expect(first.checklistId).toBe(checklist.id);
    expect(first.sortOrder).toBe(0);
    expect(first.createdAt).toBeTruthy();
    expect(first.updatedAt).toBeTruthy();

    const second = await service.createChecklistItem({
      checklistId: checklist.id,
      title: 'Label boxes',
      notes: '',
      isCompleted: false,
    });
    expect(second.sortOrder).toBe(1);

    const explicit = await service.createChecklistItem({
      checklistId: checklist.id,
      title: 'Explicit order item',
      notes: '',
      isCompleted: false,
      sortOrder: 5,
    });
    expect(explicit.sortOrder).toBe(5);
  });

  it('getChecklistItems returns items for the checklist, excluding deleted by default', async () => {
    const checklist = await service.createChecklist(baseChecklistData);
    const item = await service.createChecklistItem({
      checklistId: checklist.id,
      title: 'Pack kitchen boxes',
      notes: '',
      isCompleted: false,
    });
    const otherChecklist = await service.createChecklist({
      ...baseChecklistData,
      title: 'Other checklist',
    });
    const otherItem = await service.createChecklistItem({
      checklistId: otherChecklist.id,
      title: 'Other checklist item',
      notes: '',
      isCompleted: false,
    });

    const defaultResult = await service.getChecklistItems(checklist.id);
    expect(defaultResult.map((i) => i.id)).toEqual([item.id]);
    expect(defaultResult.some((i) => i.id === otherItem.id)).toBe(false);

    await service.deleteChecklistItem(item.id);
    const afterDelete = await service.getChecklistItems(checklist.id);
    expect(afterDelete.length).toBe(0);

    const withDeleted = await service.getChecklistItems(checklist.id, {
      includeDeleted: true,
    });
    expect(withDeleted.some((i) => i.id === item.id)).toBe(true);
  });

  it('updateChecklistItem applies partial changes and bumps updatedAt', async () => {
    const checklist = await service.createChecklist(baseChecklistData);
    const item = await service.createChecklistItem({
      checklistId: checklist.id,
      title: 'Pack kitchen boxes',
      notes: '',
      isCompleted: false,
    });

    const updated = await service.updateChecklistItem(item.id, {
      title: 'Pack kitchen boxes (updated)',
      isCompleted: true,
    });

    expect(updated.id).toBe(item.id);
    expect(updated.title).toBe('Pack kitchen boxes (updated)');
    expect(updated.isCompleted).toBe(true);
    expect(updated.checklistId).toBe(checklist.id);
  });

  it('deleteChecklistItem soft-deletes by calling ChecklistRepository.softDeleteItem', async () => {
    const checklist = await service.createChecklist(baseChecklistData);
    const item = await service.createChecklistItem({
      checklistId: checklist.id,
      title: 'Pack kitchen boxes',
      notes: '',
      isCompleted: false,
    });

    await service.deleteChecklistItem(item.id);

    const stored = await fakeRepository.findItemsByChecklistId(
      checklist.id,
      CURRENT_UID,
      { includeDeleted: true }
    );
    const found = stored.find((i) => i.id === item.id);
    expect(found).toBeTruthy();
    expect(found?.deletedAt).toBeTruthy();

    const visible = await service.getChecklistItems(checklist.id);
    expect(visible.some((i) => i.id === item.id)).toBe(false);
  });

  it('reorderChecklistItems rewrites sortOrder for the given items in order', async () => {
    const checklist = await service.createChecklist(baseChecklistData);
    const itemA = await service.createChecklistItem({
      checklistId: checklist.id,
      title: 'Item A',
      notes: '',
      isCompleted: false,
    });
    const itemB = await service.createChecklistItem({
      checklistId: checklist.id,
      title: 'Item B',
      notes: '',
      isCompleted: false,
    });
    const itemC = await service.createChecklistItem({
      checklistId: checklist.id,
      title: 'Item C',
      notes: '',
      isCompleted: false,
    });

    await service.reorderChecklistItems(checklist.id, [
      itemC.id,
      itemA.id,
      itemB.id,
    ]);

    const items = await service.getChecklistItems(checklist.id);
    const byId = new Map(items.map((i) => [i.id, i.sortOrder]));
    expect(byId.get(itemC.id)).toBe(0);
    expect(byId.get(itemA.id)).toBe(1);
    expect(byId.get(itemB.id)).toBe(2);
  });
});
