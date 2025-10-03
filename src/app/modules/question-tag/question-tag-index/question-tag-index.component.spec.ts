import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionTagIndexComponent } from './question-tag-index.component';

describe('QuestionTagIndexComponent', () => {
  let component: QuestionTagIndexComponent;
  let fixture: ComponentFixture<QuestionTagIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QuestionTagIndexComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QuestionTagIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
