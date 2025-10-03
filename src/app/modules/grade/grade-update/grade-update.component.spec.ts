import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GradeUpdateComponent } from './grade-update.component';

describe('GradeUpdateComponent', () => {
  let component: GradeUpdateComponent;
  let fixture: ComponentFixture<GradeUpdateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GradeUpdateComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GradeUpdateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
