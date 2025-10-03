import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentTagIndexComponent } from './document-tag-index.component';

describe('DocumentTagIndexComponent', () => {
  let component: DocumentTagIndexComponent;
  let fixture: ComponentFixture<DocumentTagIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DocumentTagIndexComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DocumentTagIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
