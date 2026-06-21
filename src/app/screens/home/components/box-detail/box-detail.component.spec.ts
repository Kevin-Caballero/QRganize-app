import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { BoxDetailComponent } from './box-detail.component';
import { BOX_REPOSITORY } from 'src/app/shared/repositories/box.repository.interface';
import { BoxFakeRepository } from 'src/app/shared/repositories/box-fake.repository';
import { ITEM_REPOSITORY } from 'src/app/shared/repositories/item.repository.interface';
import { ItemFakeRepository } from 'src/app/shared/repositories/item-fake.repository';
import { AUTH_REPOSITORY } from 'src/app/shared/repositories/auth.repository.interface';
import { AuthFakeRepository } from 'src/app/shared/repositories/auth-fake.repository';

describe('BoxDetailComponent', () => {
  let component: BoxDetailComponent;
  let fixture: ComponentFixture<BoxDetailComponent>;

  // Per Spec 011 ("Per-user local data scoping"), `LocalBoxesService`/
  // `LocalItemsService` now require an authenticated user via
  // `AuthGateService` — provide `AUTH_REPOSITORY` with a fake so this
  // component (and the services it indirectly constructs) resolve cleanly.
  beforeEach(waitForAsync(async () => {
    const fakeAuthRepository = new AuthFakeRepository();
    await fakeAuthRepository.signUpWithEmail('test@example.com', 'pw12345');

    TestBed.configureTestingModule({
      declarations: [ BoxDetailComponent ],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: BOX_REPOSITORY, useClass: BoxFakeRepository },
        { provide: ITEM_REPOSITORY, useClass: ItemFakeRepository },
        { provide: AUTH_REPOSITORY, useValue: fakeAuthRepository },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BoxDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
