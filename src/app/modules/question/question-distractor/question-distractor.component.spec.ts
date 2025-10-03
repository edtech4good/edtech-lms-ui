import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionDistractorComponent } from './question-distractor.component';

describe('QuestionDistractorComponent', () => {
  let component: QuestionDistractorComponent;
  let fixture: ComponentFixture<QuestionDistractorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QuestionDistractorComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QuestionDistractorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
