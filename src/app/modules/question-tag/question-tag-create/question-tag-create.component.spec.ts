import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionTagCreateComponent } from './question-tag-create.component';

describe('QuestionTagCreateComponent', () => {
  let component: QuestionTagCreateComponent;
  let fixture: ComponentFixture<QuestionTagCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QuestionTagCreateComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QuestionTagCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
