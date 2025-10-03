import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolContributeComponent } from './school-contribute.component';

describe('SchoolContributeComponent', () => {
  let component: SchoolContributeComponent;
  let fixture: ComponentFixture<SchoolContributeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SchoolContributeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SchoolContributeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
