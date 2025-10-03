import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SharedModule } from 'src/app/shared/shared.module';
import { DocumentTagCreateComponent } from './document-tag-create/document-tag-create.component';
import { DocumentTagIndexComponent } from './document-tag-index/document-tag-index.component';
import { DocumentTagRoutingModule } from './document-tag-routing.module';
import { DocumentTagUpdateComponent } from './document-tag-update/document-tag-update.component';


@NgModule({
  declarations: [
    DocumentTagIndexComponent,
    DocumentTagCreateComponent,
    DocumentTagUpdateComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    DocumentTagRoutingModule,
  ],
  providers: [
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class DocumentTagModule { }
