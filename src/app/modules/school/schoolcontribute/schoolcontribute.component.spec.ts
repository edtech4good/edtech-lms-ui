import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolcontributeComponent } from './schoolcontribute.component';

describe('SchoolcontributeComponent', () => {
  let component: SchoolcontributeComponent;
  let fixture: ComponentFixture<SchoolcontributeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SchoolcontributeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SchoolcontributeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
