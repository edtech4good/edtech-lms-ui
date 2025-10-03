import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LessonPracticeQuestionsComponent } from './lesson-practice-questions.component';

describe('LessonPracticeQuestionsComponent', () => {
  let component: LessonPracticeQuestionsComponent;
  let fixture: ComponentFixture<LessonPracticeQuestionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LessonPracticeQuestionsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LessonPracticeQuestionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
