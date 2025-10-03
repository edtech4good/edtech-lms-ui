import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CountryCreateComponent } from './country-create.component';

describe('CountryCreateComponent', () => {
  let component: CountryCreateComponent;
  let fixture: ComponentFixture<CountryCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CountryCreateComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CountryCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
