import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LevelQuizComponent } from './level-quiz.component';

describe('LevelQuizComponent', () => {
  let component: LevelQuizComponent;
  let fixture: ComponentFixture<LevelQuizComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LevelQuizComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LevelQuizComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
