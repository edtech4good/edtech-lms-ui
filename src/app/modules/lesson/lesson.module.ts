import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { SharedModule } from 'src/app/shared/shared.module';
import { LessonCreateComponent } from './lesson-create/lesson-create.component';
import { LessonIndexComponent } from './lesson-index/lesson-index.component';
import { LessonRoutingModule } from './lesson-routing.module';
import { LessonUpdateComponent } from './lesson-update/lesson-update.component';
import { LessonLearningComponent } from './lesson-learning/lesson-learning.component';
import { LessonPracticeComponent } from './lesson-practice/lesson-practice.component';
import { LessonQuizComponent } from './lesson-quiz/lesson-quiz.component';
import { LessonQuizQuestionsComponent } from './lesson-quiz-questions/lesson-quiz-questions.component';
import { LessonPracticeQuestionsComponent } from './lesson-practice-questions/lesson-practice-questions.component';
import { SharedComponentsModule } from '../shared-modules/shared-components.module';
import { LessonPlanComponent } from './lesson-plan/lesson-plan.component';


@NgModule({
  declarations: [
    LessonIndexComponent,
    LessonCreateComponent,
    LessonUpdateComponent,
    LessonLearningComponent,
    LessonPracticeComponent,
    LessonQuizComponent,
    LessonQuizQuestionsComponent,
    LessonPracticeQuestionsComponent,
    LessonPlanComponent,
  ],
  imports: [
    CommonModule,
    SharedComponentsModule,
    SharedModule,
    LessonRoutingModule
  ],
  providers: [
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LessonModule { }
