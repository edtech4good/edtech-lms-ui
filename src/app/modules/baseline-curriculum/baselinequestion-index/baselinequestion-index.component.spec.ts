import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BaselinequestionIndexComponent } from './baselinequestion-index.component';

describe('BaselinequestionIndexComponent', () => {
  let component: BaselinequestionIndexComponent;
  let fixture: ComponentFixture<BaselinequestionIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BaselinequestionIndexComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BaselinequestionIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
