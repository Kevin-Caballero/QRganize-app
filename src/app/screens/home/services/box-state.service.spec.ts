import { TestBed } from '@angular/core/testing';

import { BoxStateService } from './box-state.service';
import { BOX_REPOSITORY } from 'src/app/shared/repositories/box.repository.interface';
import { BoxFakeRepository } from 'src/app/shared/repositories/box-fake.repository';
import { AUTH_REPOSITORY } from 'src/app/shared/repositories/auth.repository.interface';
import { AuthFakeRepository } from 'src/app/shared/repositories/auth-fake.repository';

describe('BoxStateService', () => {
  let service: BoxStateService;
  let fakeAuthRepository: AuthFakeRepository;

  // Per Spec 011 ("Per-user local data scoping"), `LocalBoxesService`
  // (reached via `BoxService`) now requires an authenticated user — see
  // `local-boxes.service.spec.ts`'s equivalent setup.
  beforeEach(async () => {
    fakeAuthRepository = new AuthFakeRepository();

    TestBed.configureTestingModule({
      providers: [
        { provide: BOX_REPOSITORY, useClass: BoxFakeRepository },
        { provide: AUTH_REPOSITORY, useValue: fakeAuthRepository },
      ],
    });
    service = TestBed.inject(BoxStateService);
    await fakeAuthRepository.signUpWithEmail('test@example.com', 'pw12345');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
