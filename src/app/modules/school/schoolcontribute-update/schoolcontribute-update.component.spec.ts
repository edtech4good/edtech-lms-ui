import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolcontributeUpdateComponent } from './schoolcontribute-update.component';

describe('SchoolcontributeUpdateComponent', () => {
  let component: SchoolcontributeUpdateComponent;
  let fixture: ComponentFixture<SchoolcontributeUpdateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SchoolcontributeUpdateComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SchoolcontributeUpdateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
