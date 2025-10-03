import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CountryUpdateComponent } from './country-update.component';

describe('CountryUpdateComponent', () => {
  let component: CountryUpdateComponent;
  let fixture: ComponentFixture<CountryUpdateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CountryUpdateComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CountryUpdateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
