import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BaselineCurriculumUpdateComponent } from './baseline-curriculum-update.component';

describe('BaselineCurriculumUpdateComponent', () => {
  let component: BaselineCurriculumUpdateComponent;
  let fixture: ComponentFixture<BaselineCurriculumUpdateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BaselineCurriculumUpdateComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BaselineCurriculumUpdateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
