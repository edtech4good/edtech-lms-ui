import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentTagCreateComponent } from './document-tag-create.component';

describe('DocumentTagCreateComponent', () => {
  let component: DocumentTagCreateComponent;
  let fixture: ComponentFixture<DocumentTagCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DocumentTagCreateComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DocumentTagCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
