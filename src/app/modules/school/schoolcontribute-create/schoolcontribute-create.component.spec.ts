import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolCreateContributeComponent } from './schoolcontribute-create.component';

describe('SchoolUpdateContributeComponent', () => {
  let component: SchoolCreateContributeComponent;
  let fixture: ComponentFixture<SchoolCreateContributeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SchoolCreateContributeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SchoolCreateContributeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
