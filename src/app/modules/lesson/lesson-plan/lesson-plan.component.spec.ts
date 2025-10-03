import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LessonLearningComponent } from '../lesson-learning/lesson-learning.component';

describe('LessonLearningComponent', () => {
  let component: LessonLearningComponent;
  let fixture: ComponentFixture<LessonLearningComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LessonLearningComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LessonLearningComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
