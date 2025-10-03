import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentTagUpdateComponent } from './document-tag-update.component';

describe('DocumentTagUpdateComponent', () => {
  let component: DocumentTagUpdateComponent;
  let fixture: ComponentFixture<DocumentTagUpdateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DocumentTagUpdateComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DocumentTagUpdateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
