import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TicketSearchBox } from './ticket-search-box';

describe('TicketSearchBox', () => {
  let component: TicketSearchBox;
  let fixture: ComponentFixture<TicketSearchBox>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketSearchBox]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TicketSearchBox);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
