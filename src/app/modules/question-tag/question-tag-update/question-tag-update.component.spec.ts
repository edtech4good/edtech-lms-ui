import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionTagUpdateComponent } from './question-tag-update.component';

describe('QuestionTagUpdateComponent', () => {
  let component: QuestionTagUpdateComponent;
  let fixture: ComponentFixture<QuestionTagUpdateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QuestionTagUpdateComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QuestionTagUpdateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
