import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeedbackIndexComponent } from './feedback-index.component';

describe('FeedbackIndexComponent', () => {
  let component: FeedbackIndexComponent;
  let fixture: ComponentFixture<FeedbackIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FeedbackIndexComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FeedbackIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
