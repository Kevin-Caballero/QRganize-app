import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthFakeRepository } from '../shared/repositories/auth-fake.repository';
import { AUTH_REPOSITORY } from '../shared/repositories/auth.repository.interface';
import { AuthGateService } from '../shared/services/auth-gate.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let fakeRepository: AuthFakeRepository;
  let router: Router;

  beforeEach(() => {
    fakeRepository = new AuthFakeRepository();

    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        AuthGuard,
        AuthGateService,
        { provide: AUTH_REPOSITORY, useValue: fakeRepository },
      ],
    });

    guard = TestBed.inject(AuthGuard);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    fakeRepository.reset();
  });

  it('allows activation when authenticated', async () => {
    await fakeRepository.signUpWithEmail('test@example.com', 'pw12345');
    expect(await guard.canActivate()).toBe(true);
  });

  it('redirects to /login when not authenticated', async () => {
    const result = await guard.canActivate();
    expect(result).toEqual(router.createUrlTree(['/login']));
  });
});
