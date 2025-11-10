import { TestBed } from '@angular/core/testing';

import { AvailableServices } from './available-services';

describe('AvailableServices', () => {
  let service: AvailableServices;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AvailableServices);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
