import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BaselineCurriculumSchoolComponent } from './baseline-curriculum-school.component';

describe('BaselineCurriculumSchoolComponent', () => {
  let component: BaselineCurriculumSchoolComponent;
  let fixture: ComponentFixture<BaselineCurriculumSchoolComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BaselineCurriculumSchoolComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BaselineCurriculumSchoolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
