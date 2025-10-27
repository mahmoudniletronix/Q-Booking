import { TestBed } from '@angular/core/testing';

import { ScheduleServices } from './schedule-services';

describe('ScheduleServices', () => {
  let service: ScheduleServices;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScheduleServices);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
