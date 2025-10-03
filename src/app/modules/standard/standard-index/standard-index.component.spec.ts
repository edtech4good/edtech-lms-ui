import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StandardIndexComponent } from './standard-index.component';

describe('StandardIndexComponent', () => {
  let component: StandardIndexComponent;
  let fixture: ComponentFixture<StandardIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StandardIndexComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StandardIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
