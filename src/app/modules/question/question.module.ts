import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { QuestionRoutingModule } from './question-routing.module';
import { QuestionCreateComponent } from './question-create/question-create.component';
import { QuestionHeadingComponent } from './question-heading/question-heading.component';
import { QuestionDistractorComponent } from './question-distractor/question-distractor.component';
import { QuestionAssociateComponent } from './question-associate/question-associate.component';
import { QuestionOptionComponent } from './question-option/question-option.component';
import { SharedModule } from 'src/app/shared/shared.module';
import { QuestionOptionHolderComponent } from './question-option-holder/question-option-holder.component';
import { QuestionIndexComponent } from '../question/question-index/question-index.component';
import { QuestionUpdateComponent } from './question-update/question-update.component';
import { SharedComponentsModule } from '../shared-modules/shared-components.module';


@NgModule({
  declarations: [
    QuestionCreateComponent,
    QuestionUpdateComponent,
    QuestionHeadingComponent,
    QuestionDistractorComponent,
    QuestionAssociateComponent,
    QuestionOptionComponent,
    QuestionOptionHolderComponent,
    QuestionIndexComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    SharedComponentsModule,
    QuestionRoutingModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class QuestionModule { }
