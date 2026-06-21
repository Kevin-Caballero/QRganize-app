import { TestBed } from '@angular/core/testing';
import { BoxService } from './box.service';
import { BOX_REPOSITORY } from 'src/app/shared/repositories/box.repository.interface';
import { BoxFakeRepository } from 'src/app/shared/repositories/box-fake.repository';
import { ITEM_REPOSITORY } from 'src/app/shared/repositories/item.repository.interface';
import { ItemFakeRepository } from 'src/app/shared/repositories/item-fake.repository';
import { AUTH_REPOSITORY } from 'src/app/shared/repositories/auth.repository.interface';
import { AuthFakeRepository } from 'src/app/shared/repositories/auth-fake.repository';
import { ItemService } from './item.service';

describe('BoxService', () => {
  let service: BoxService;
  let itemService: ItemService;
  let fakeAuthRepository: AuthFakeRepository;

  // Per Spec 011 ("Per-user local data scoping"), `LocalBoxesService` (which
  // `BoxService` sits on top of) now requires an authenticated user — see
  // `local-boxes.service.spec.ts`'s equivalent setup.
  beforeEach(async () => {
    fakeAuthRepository = new AuthFakeRepository();

    TestBed.configureTestingModule({
      providers: [
        { provide: BOX_REPOSITORY, useClass: BoxFakeRepository },
        { provide: ITEM_REPOSITORY, useClass: ItemFakeRepository },
        { provide: AUTH_REPOSITORY, useValue: fakeAuthRepository },
      ],
    });
    service = TestBed.inject(BoxService);
    itemService = TestBed.inject(ItemService);
    await fakeAuthRepository.signUpWithEmail('test@example.com', 'pw12345');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('seals a box and maps the result back to the legacy Box shape', (done) => {
    service.createBox({ name: 'Box A', description: '', image: '' }).subscribe((box) => {
      service.sealBox(box.id).subscribe((sealed) => {
        expect(sealed.id).toBe(box.id);
        expect(sealed.packingStatus).toBe('sealed');
        done();
      });
    });
  });

  it('reopens a sealed box', (done) => {
    service.createBox({ name: 'Box B', description: '', image: '' }).subscribe((box) => {
      service.sealBox(box.id).subscribe(() => {
        service.reopenBox(box.id).subscribe((reopened) => {
          expect(reopened.packingStatus).toBe('packing');
          done();
        });
      });
    });
  });

  // Spec 013: searchBoxes() must populate `items` and match on box
  // name/description OR item name/description, not just box.name.
  describe('searchBoxes', () => {
    it('matches by box name and populates items', (done) => {
      service
        .createBox({ name: 'Garage Stuff', description: '', image: '' })
        .subscribe((box) => {
          itemService
            .createItem(box.id, { name: 'Camping Tent', description: '' })
            .subscribe(() => {
              service.searchBoxes('garage').subscribe((results) => {
                expect(results.length).toBe(1);
                expect(results[0].name).toBe('Garage Stuff');
                expect(results[0].items?.length).toBe(1);
                expect(results[0].items?.[0].name).toBe('Camping Tent');
                done();
              });
            });
        });
    });

    it('matches by box description', (done) => {
      service
        .createBox({
          name: 'Box C',
          description: 'Holiday decorations',
          image: '',
        })
        .subscribe(() => {
          service.searchBoxes('holiday').subscribe((results) => {
            expect(results.length).toBe(1);
            expect(results[0].name).toBe('Box C');
            done();
          });
        });
    });

    it('matches a box only via an item name/description match (regression fix)', (done) => {
      service
        .createBox({ name: 'Garage Stuff', description: '', image: '' })
        .subscribe((box) => {
          itemService
            .createItem(box.id, { name: 'Camping Tent', description: '' })
            .subscribe(() => {
              service.searchBoxes('tent').subscribe((results) => {
                expect(results.length).toBe(1);
                expect(results[0].name).toBe('Garage Stuff');
                expect(results[0].items?.some((i) => i.name === 'Camping Tent')).toBe(
                  true
                );
                done();
              });
            });
        });
    });

    it('excludes boxes/items that do not match', (done) => {
      service
        .createBox({ name: 'Kitchen Box', description: '', image: '' })
        .subscribe(() => {
          service.searchBoxes('nonexistent-term').subscribe((results) => {
            expect(results.length).toBe(0);
            done();
          });
        });
    });
  });
});
