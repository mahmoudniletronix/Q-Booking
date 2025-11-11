import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReceivedList } from './received-list';

describe('ReceivedList', () => {
  let component: ReceivedList;
  let fixture: ComponentFixture<ReceivedList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceivedList],
    }).compileComponents();

    fixture = TestBed.createComponent(ReceivedList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
