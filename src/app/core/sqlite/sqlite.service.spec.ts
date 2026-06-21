import { TestBed } from '@angular/core/testing';

import { SqliteService } from './sqlite.service';

describe('SqliteService', () => {
  let service: SqliteService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SqliteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('rejects execute() before initialize() has completed', async () => {
    await expectAsync(service.execute('SELECT 1;')).toBeRejectedWithError(
      /initialize\(\)/
    );
  });

  it('rejects query() before initialize() has completed', async () => {
    await expectAsync(service.query('SELECT 1;')).toBeRejectedWithError(
      /initialize\(\)/
    );
  });

  it('rejects transaction() before initialize() has completed', async () => {
    await expectAsync(
      service.transaction(async () => undefined)
    ).toBeRejectedWithError(/initialize\(\)/);
  });
});
