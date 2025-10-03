import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LessonUpdateComponent } from './lesson-update.component';

describe('LessonUpdateComponent', () => {
  let component: LessonUpdateComponent;
  let fixture: ComponentFixture<LessonUpdateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LessonUpdateComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LessonUpdateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
