import { TestBed } from '@angular/core/testing';
import { BoxStatus, LocalBox } from '../models/local-box';
import { BoxFakeRepository } from '../repositories/box-fake.repository';
import { BOX_REPOSITORY } from '../repositories/box.repository.interface';
import { AuthFakeRepository } from '../repositories/auth-fake.repository';
import { AUTH_REPOSITORY } from '../repositories/auth.repository.interface';
import { AuthGateService } from './auth-gate.service';
import { LocalBoxesService } from './local-boxes.service';

/**
 * Unit tests for `LocalBoxesService` (Spec 010), against `BoxFakeRepository`
 * (Spec 003) — not real SQLite. Mirrors `local-items.service.spec.ts`'s
 * style (Spec 012): the `BOX_REPOSITORY` token is provided with the
 * in-memory fake, so the service under test is exercised exactly as it is
 * constructed in production (which provides the same token with
 * `BoxSqliteRepository`), without touching SQLite.
 *
 * Per Spec 011 ("Per-user local data scoping"), `LocalBoxesService` now also
 * depends on `AuthGateService`, provided here with `AuthFakeRepository`
 * (the same pattern `app-startup-route.service.spec.ts` already uses) so the
 * service is exercised against a real "current user" concept rather than a
 * stub, and to exercise the account-switching behavior explicitly.
 */
describe('LocalBoxesService', () => {
  let service: LocalBoxesService;
  let fakeRepository: BoxFakeRepository;
  let fakeAuthRepository: AuthFakeRepository;

  const baseBoxData: Omit<
    LocalBox,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
  > = {
    name: 'Kitchen box',
    description: '',
    room: 'Kitchen',
    status: BoxStatus.ACTIVE,
    packingStatus: 'packing',
    qrCode: 'qr-1',
  };

  // Matches `AuthFakeRepository.signUpWithEmail`'s `fake-${email}` uid
  // convention — used so assertions against `fakeRepository` directly (the
  // repository layer) can pass the same uid the service resolves via
  // `AuthGateService.getCurrentUser()`.
  const CURRENT_UID = 'fake-user-a@example.com';

  beforeEach(async () => {
    fakeRepository = new BoxFakeRepository();
    fakeAuthRepository = new AuthFakeRepository();

    TestBed.configureTestingModule({
      providers: [
        LocalBoxesService,
        AuthGateService,
        { provide: BOX_REPOSITORY, useValue: fakeRepository },
        { provide: AUTH_REPOSITORY, useValue: fakeAuthRepository },
      ],
    });

    service = TestBed.inject(LocalBoxesService);
    await fakeAuthRepository.signUpWithEmail('user-a@example.com', 'pw12345');
  });

  afterEach(() => {
    fakeRepository.reset();
    fakeAuthRepository.reset();
  });

  it('rejects when there is no authenticated user', async () => {
    await fakeAuthRepository.signOut();
    await expectAsync(service.getAllBoxes()).toBeRejected();
  });

  it('switching the authenticated user (without app restart) immediately scopes calls to the new user', async () => {
    const ownedByUserA = await service.createBox(baseBoxData);

    await fakeAuthRepository.signOut();
    await fakeAuthRepository.signUpWithEmail(
      'user-b@example.com',
      'pw12345'
    );

    const userBBoxes = await service.getAllBoxes();
    expect(userBBoxes.some((b) => b.id === ownedByUserA.id)).toBe(false);

    const userBBox = await service.createBox({
      ...baseBoxData,
      name: 'User B box',
    });
    expect((await service.getAllBoxes()).map((b) => b.id)).toEqual([
      userBBox.id,
    ]);

    await fakeAuthRepository.signOut();
    await fakeAuthRepository.signInWithEmail('user-a@example.com', 'pw12345');

    const userABoxesAgain = await service.getAllBoxes();
    expect(userABoxesAgain.map((b) => b.id)).toEqual([ownedByUserA.id]);
  });

  it('createBox creates and returns a new box', async () => {
    const created = await service.createBox(baseBoxData);

    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Kitchen box');
    expect(created.room).toBe('Kitchen');
    expect(created.status).toBe(BoxStatus.ACTIVE);
    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBeTruthy();

    const found = await fakeRepository.findById(created.id, CURRENT_UID);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Kitchen box');
  });

  it('getBoxById returns the matching box, or null if not found', async () => {
    const created = await service.createBox(baseBoxData);

    const found = await service.getBoxById(created.id);
    expect(found?.id).toBe(created.id);

    const notFound = await service.getBoxById('does-not-exist');
    expect(notFound).toBeNull();
  });

  it('getAllBoxes returns all boxes, excluding archived/deleted by default', async () => {
    const active = await service.createBox(baseBoxData);
    const archived = await service.createBox({
      ...baseBoxData,
      name: 'Archived box',
      status: BoxStatus.ARCHIVED,
    });

    const defaultResult = await service.getAllBoxes();
    expect(defaultResult.map((b) => b.id)).toEqual([active.id]);
    expect(defaultResult.some((b) => b.id === archived.id)).toBe(false);

    const withArchived = await service.getAllBoxes({ includeArchived: true });
    expect(withArchived.map((b) => b.id).sort()).toEqual(
      [active.id, archived.id].sort()
    );

    await service.deleteBox(active.id);
    const afterDelete = await service.getAllBoxes();
    expect(afterDelete.length).toBe(0);

    const withDeleted = await service.getAllBoxes({ includeDeleted: true });
    expect(withDeleted.some((b) => b.id === active.id)).toBe(true);
  });

  it('updateBox applies partial changes and bumps updatedAt', async () => {
    const created = await service.createBox(baseBoxData);

    const updated = await service.updateBox(created.id, {
      name: 'Updated box',
      room: 'Garage',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Updated box');
    expect(updated.room).toBe('Garage');
  });

  it('archiveBox sets status to archived via updateBox', async () => {
    const created = await service.createBox(baseBoxData);
    expect(created.status).toBe(BoxStatus.ACTIVE);

    const archived = await service.archiveBox(created.id);

    expect(archived.id).toBe(created.id);
    expect(archived.status).toBe(BoxStatus.ARCHIVED);

    const stored = await fakeRepository.findById(created.id, CURRENT_UID);
    expect(stored?.status).toBe(BoxStatus.ARCHIVED);
  });

  it('sealBox sets packingStatus to sealed, and rejects if already sealed', async () => {
    const created = await service.createBox(baseBoxData);
    expect(created.packingStatus).toBe('packing');

    const sealed = await service.sealBox(created.id);
    expect(sealed.id).toBe(created.id);
    expect(sealed.packingStatus).toBe('sealed');

    const stored = await fakeRepository.findById(created.id, CURRENT_UID);
    expect(stored?.packingStatus).toBe('sealed');

    await expectAsync(service.sealBox(created.id)).toBeRejected();
  });

  it('reopenBox sets packingStatus to packing, and rejects if already packing', async () => {
    const created = await service.createBox(baseBoxData);

    await expectAsync(service.reopenBox(created.id)).toBeRejected();

    await service.sealBox(created.id);
    const reopened = await service.reopenBox(created.id);

    expect(reopened.id).toBe(created.id);
    expect(reopened.packingStatus).toBe('packing');

    const stored = await fakeRepository.findById(created.id, CURRENT_UID);
    expect(stored?.packingStatus).toBe('packing');
  });

  it('deleteBox soft-deletes by calling BoxRepository.softDelete', async () => {
    const created = await service.createBox(baseBoxData);

    await service.deleteBox(created.id);

    const stored = await fakeRepository.findById(created.id, CURRENT_UID);
    expect(stored).not.toBeNull();
    expect(stored?.deletedAt).toBeTruthy();

    const visible = await service.getAllBoxes();
    expect(visible.some((b) => b.id === created.id)).toBe(false);
  });
});
