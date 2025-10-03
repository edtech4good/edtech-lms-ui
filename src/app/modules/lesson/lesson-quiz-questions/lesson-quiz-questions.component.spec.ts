import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LessonQuizQuestionsComponent } from './lesson-quiz-questions.component';

describe('LessonQuizQuestionsComponent', () => {
  let component: LessonQuizQuestionsComponent;
  let fixture: ComponentFixture<LessonQuizQuestionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LessonQuizQuestionsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LessonQuizQuestionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
