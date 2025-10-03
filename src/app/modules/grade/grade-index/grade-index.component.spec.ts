import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GradeIndexComponent } from './grade-index.component';

describe('GradeIndexComponent', () => {
  let component: GradeIndexComponent;
  let fixture: ComponentFixture<GradeIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GradeIndexComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GradeIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
