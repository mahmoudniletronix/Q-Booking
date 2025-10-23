import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QBookingServices } from './q-booking-services';

describe('QBookingServices', () => {
  let component: QBookingServices;
  let fixture: ComponentFixture<QBookingServices>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QBookingServices]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QBookingServices);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
