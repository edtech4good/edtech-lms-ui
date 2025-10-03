import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentRoutingModule } from './document-routing.module';
import { DocumentIndexComponent } from './document-index/document-index.component';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  declarations: [
    DocumentIndexComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    DocumentRoutingModule
  ],
  providers: [
  ]
})
export class DocumentModule { }
