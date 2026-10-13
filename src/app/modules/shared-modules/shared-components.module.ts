import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UploaderComponent } from './uploader/uploader.component';
import { DocumentUploadModalComponent } from './document-upload-modal/document-upload-modal.component';
import { DocumentMetadataFieldsComponent } from './document-metadata-fields/document-metadata-fields.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  declarations: [UploaderComponent, DocumentMetadataFieldsComponent, DocumentUploadModalComponent],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    RouterModule,
    ReactiveFormsModule,
  ],
  exports: [UploaderComponent, DocumentMetadataFieldsComponent, DocumentUploadModalComponent]
})
export class SharedComponentsModule { }
