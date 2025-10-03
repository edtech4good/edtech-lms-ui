import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CurriculumCreateComponent } from './curriculum-create.component';

describe('CurriculumCreateComponent', () => {
  let component: CurriculumCreateComponent;
  let fixture: ComponentFixture<CurriculumCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CurriculumCreateComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CurriculumCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
