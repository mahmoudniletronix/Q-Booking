import { TestBed } from '@angular/core/testing';

import { TicketReservation } from './ticket-reservation';

describe('TicketReservation', () => {
  let service: TicketReservation;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TicketReservation);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
