import { TestBed } from '@angular/core/testing';

import { BoxStateService } from './box-state.service';

describe('BoxStateService', () => {
  let service: BoxStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BoxStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
