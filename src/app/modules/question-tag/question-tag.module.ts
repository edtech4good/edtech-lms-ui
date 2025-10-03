import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { SharedModule } from 'src/app/shared/shared.module';
import { QuestionTagCreateComponent } from './question-tag-create/question-tag-create.component';
import { QuestionTagIndexComponent } from './question-tag-index/question-tag-index.component';
import { QuestionTagRoutingModule } from './question-tag-routing.module';
import { QuestionTagUpdateComponent } from './question-tag-update/question-tag-update.component';


@NgModule({
  declarations: [
    QuestionTagIndexComponent,
    QuestionTagCreateComponent,
    QuestionTagUpdateComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    QuestionTagRoutingModule
  ],
  providers: [
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class QuestionTagModule { }
