import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionAssociateComponent } from './question-associate.component';

describe('QuestionAssociateComponent', () => {
  let component: QuestionAssociateComponent;
  let fixture: ComponentFixture<QuestionAssociateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QuestionAssociateComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QuestionAssociateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
