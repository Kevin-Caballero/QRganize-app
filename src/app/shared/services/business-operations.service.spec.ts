import { TestBed } from '@angular/core/testing';

import { BusinessOperationsService } from './business-operations.service';

describe('BusinessOperationsService', () => {
  let service: BusinessOperationsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BusinessOperationsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
