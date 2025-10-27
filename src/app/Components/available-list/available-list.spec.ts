import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvailableList } from './available-list';

describe('AvailableList', () => {
  let component: AvailableList;
  let fixture: ComponentFixture<AvailableList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvailableList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AvailableList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
