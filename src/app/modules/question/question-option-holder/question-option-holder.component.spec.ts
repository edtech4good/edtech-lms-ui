import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionOptionHolderComponent } from './question-option-holder.component';

describe('QuestionOptionHolderComponent', () => {
  let component: QuestionOptionHolderComponent;
  let fixture: ComponentFixture<QuestionOptionHolderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QuestionOptionHolderComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QuestionOptionHolderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
