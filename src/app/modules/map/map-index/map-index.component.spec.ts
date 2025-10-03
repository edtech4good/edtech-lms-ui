import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapIndexComponent } from './map-index.component';

describe('MapIndexComponent', () => {
  let component: MapIndexComponent;
  let fixture: ComponentFixture<MapIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MapIndexComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MapIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
