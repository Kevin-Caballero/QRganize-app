import { TestBed } from '@angular/core/testing';
import { ChecklistService } from './checklist.service';
import { CHECKLIST_REPOSITORY } from 'src/app/shared/repositories/checklist.repository.interface';
import { ChecklistFakeRepository } from 'src/app/shared/repositories/checklist-fake.repository';
import { AUTH_REPOSITORY } from 'src/app/shared/repositories/auth.repository.interface';
import { AuthFakeRepository } from 'src/app/shared/repositories/auth-fake.repository';
import { LocalChecklistsService } from 'src/app/shared/services/local-checklists.service';
import { ChecklistStatus } from 'src/app/shared/models/local-checklist';

describe('ChecklistService', () => {
  let service: ChecklistService;
  let localChecklistsService: LocalChecklistsService;
  let fakeAuthRepository: AuthFakeRepository;

  // Mirrors box.service.spec.ts's Spec 011 setup: LocalChecklistsService
  // requires an authenticated user.
  beforeEach(async () => {
    fakeAuthRepository = new AuthFakeRepository();

    TestBed.configureTestingModule({
      providers: [
        { provide: CHECKLIST_REPOSITORY, useClass: ChecklistFakeRepository },
        { provide: AUTH_REPOSITORY, useValue: fakeAuthRepository },
      ],
    });
    service = TestBed.inject(ChecklistService);
    localChecklistsService = TestBed.inject(LocalChecklistsService);
    await fakeAuthRepository.signUpWithEmail('test@example.com', 'pw12345');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('matches checklists by title', (done) => {
    localChecklistsService
      .createChecklist({
        title: 'Kitchen Packing List',
        description: '',
        status: ChecklistStatus.ACTIVE,
      })
      .then(() => {
        service.searchChecklists('kitchen').subscribe((results) => {
          expect(results.length).toBe(1);
          expect(results[0].title).toBe('Kitchen Packing List');
          done();
        });
      });
  });

  it('matches checklists by description', (done) => {
    localChecklistsService
      .createChecklist({
        title: 'List A',
        description: 'Stuff for the garage move',
        status: ChecklistStatus.ACTIVE,
      })
      .then(() => {
        service.searchChecklists('garage').subscribe((results) => {
          expect(results.length).toBe(1);
          expect(results[0].title).toBe('List A');
          done();
        });
      });
  });

  it('matches checklists via a checklist-item title', (done) => {
    localChecklistsService
      .createChecklist({
        title: 'Moving List',
        description: '',
        status: ChecklistStatus.ACTIVE,
      })
      .then((checklist) =>
        localChecklistsService
          .createChecklistItem({
            checklistId: checklist.id,
            title: 'Pack the dishes',
            notes: '',
            isCompleted: false,
          })
          .then(() => checklist)
      )
      .then((checklist) => {
        service.searchChecklists('dishes').subscribe((results) => {
          expect(results.length).toBe(1);
          expect(results[0].id).toBe(checklist.id);
          done();
        });
      });
  });

  it('excludes checklists that do not match', (done) => {
    localChecklistsService
      .createChecklist({
        title: 'Unrelated checklist',
        description: '',
        status: ChecklistStatus.ACTIVE,
      })
      .then(() => {
        service.searchChecklists('nonexistent-term').subscribe((results) => {
          expect(results.length).toBe(0);
          done();
        });
      });
  });
});
