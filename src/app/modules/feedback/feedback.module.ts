import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'src/app/shared/shared.module';
import { FeedbackIndexComponent } from './feedback-index/feedback-index.component';
import { FeedbackCreateComponent } from './feedback-create/feedback-create.component';
import { FeedbackRoutingModule } from './feedback-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FeedbackViewComponent } from './feedback-view/feedback-view.component';


@NgModule({
  declarations: [
    FeedbackIndexComponent,
    FeedbackCreateComponent,
    FeedbackViewComponent,
  ],
  imports: [
    CommonModule,
    FeedbackRoutingModule,
    SharedModule,
    FormsModule
  ]
})
export class FeedbackModule { }
