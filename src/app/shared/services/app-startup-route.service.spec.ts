import { TestBed } from '@angular/core/testing';
import { Storage } from '@ionic/storage-angular';

import { AppStartupRouteService } from './app-startup-route.service';
import { AuthFakeRepository } from '../repositories/auth-fake.repository';
import { AUTH_REPOSITORY } from '../repositories/auth.repository.interface';
import { AuthGateService } from './auth-gate.service';
import { SqliteService } from '../../core/sqlite/sqlite.service';

describe('AppStartupRouteService', () => {
  let service: AppStartupRouteService;
  let storageSpy: jasmine.SpyObj<Storage>;
  let sqliteServiceSpy: jasmine.SpyObj<SqliteService>;
  let fakeRepository: AuthFakeRepository;

  beforeEach(() => {
    storageSpy = jasmine.createSpyObj('Storage', ['get']);
    sqliteServiceSpy = jasmine.createSpyObj('SqliteService', [
      'backfillFirebaseUid',
    ]);
    sqliteServiceSpy.backfillFirebaseUid.and.resolveTo();
    fakeRepository = new AuthFakeRepository();

    TestBed.configureTestingModule({
      providers: [
        { provide: Storage, useValue: storageSpy },
        AuthGateService,
        { provide: AUTH_REPOSITORY, useValue: fakeRepository },
        { provide: SqliteService, useValue: sqliteServiceSpy },
      ],
    });
    service = TestBed.inject(AppStartupRouteService);
  });

  afterEach(() => {
    fakeRepository.reset();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('resolves to /login when there is no authenticated user (Spec 010 mandatory gate)', async () => {
    storageSpy.get.and.resolveTo(true);

    const route = await service.resolveStartupRoute();

    expect(route).toBe('/login');
    expect(storageSpy.get).not.toHaveBeenCalled();
    expect(sqliteServiceSpy.backfillFirebaseUid).not.toHaveBeenCalled();
  });

  it('resolves to /onboarding when authenticated but onboarding is not complete', async () => {
    const user = await fakeRepository.signUpWithEmail(
      'test@example.com',
      'pw12345'
    );
    storageSpy.get.and.resolveTo(false);

    const route = await service.resolveStartupRoute();

    expect(route).toBe('/onboarding');
    expect(storageSpy.get).toHaveBeenCalledWith('onboardingComplete');
    expect(sqliteServiceSpy.backfillFirebaseUid).toHaveBeenCalledWith(
      user.uid
    );
  });

  it('resolves to /tabs/home when authenticated and onboarding is complete', async () => {
    await fakeRepository.signUpWithEmail('test@example.com', 'pw12345');
    storageSpy.get.and.resolveTo(true);

    const route = await service.resolveStartupRoute();

    expect(route).toBe('/tabs/home');
  });

  it('resolves to /onboarding when authenticated and the flag is undefined (fresh install)', async () => {
    await fakeRepository.signUpWithEmail('test@example.com', 'pw12345');
    storageSpy.get.and.resolveTo(undefined);

    const route = await service.resolveStartupRoute();

    expect(route).toBe('/onboarding');
  });
});
