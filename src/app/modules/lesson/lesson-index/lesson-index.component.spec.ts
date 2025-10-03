import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LessonIndexComponent } from './lesson-index.component';

describe('LessonIndexComponent', () => {
  let component: LessonIndexComponent;
  let fixture: ComponentFixture<LessonIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LessonIndexComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LessonIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
