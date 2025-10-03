import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolIndexComponent } from './school-index.component';

describe('SchoolIndexComponent', () => {
  let component: SchoolIndexComponent;
  let fixture: ComponentFixture<SchoolIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SchoolIndexComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SchoolIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
