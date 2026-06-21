import { TestBed } from '@angular/core/testing';
import { AuthFakeRepository } from '../repositories/auth-fake.repository';
import { AUTH_REPOSITORY } from '../repositories/auth.repository.interface';
import { AuthGateService } from './auth-gate.service';

describe('AuthGateService', () => {
  let service: AuthGateService;
  let fakeRepository: AuthFakeRepository;

  beforeEach(() => {
    fakeRepository = new AuthFakeRepository();

    TestBed.configureTestingModule({
      providers: [
        AuthGateService,
        { provide: AUTH_REPOSITORY, useValue: fakeRepository },
      ],
    });

    service = TestBed.inject(AuthGateService);
  });

  afterEach(() => {
    fakeRepository.reset();
  });

  it('isAuthenticated returns false when signed out', async () => {
    expect(await service.isAuthenticated()).toBe(false);
  });

  it('signUpWithEmail creates a user and authenticates', async () => {
    const user = await service.signUpWithEmail('test@example.com', 'pw12345');
    expect(user.email).toBe('test@example.com');
    expect(await service.isAuthenticated()).toBe(true);
  });

  it('signInWithEmail with wrong credentials throws', async () => {
    await service.signUpWithEmail('test@example.com', 'pw12345');
    await service.signOut();

    await expectAsync(
      service.signInWithEmail('test@example.com', 'wrong')
    ).toBeRejected();
  });

  it('signOut clears authentication state', async () => {
    await service.signUpWithEmail('test@example.com', 'pw12345');
    await service.signOut();
    expect(await service.isAuthenticated()).toBe(false);
  });

  it('signInWithGoogle authenticates a user', async () => {
    const user = await service.signInWithGoogle();
    expect(user.uid).toBe('fake-google-uid');
    expect(await service.isAuthenticated()).toBe(true);
  });
});
