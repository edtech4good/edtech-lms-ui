import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { NgxPermissionsModule } from 'ngx-permissions';
import { NgxSpinnerModule } from 'ngx-spinner';
import { AuthInterceptor } from '../interceptors/auth.interceptor';
import { ErrorInterceptor } from '../interceptors/error.interceptor';
import { DocumentService } from '../modules/document/services/document.service';
import { CoreService } from '../services/core.service';
import { CurriculumService } from '../services/curriculum.service';
import { DocumentTagService } from '../services/document-tag.service';
import { DropDownService } from '../services/dropdown.service';
import { GradeService } from '../services/grade.service';
import { LessonLearningService } from '../services/lesson.learning.service';
import { LessonPracticeService } from '../services/lesson.practice.service';
import { LessonQuizService } from '../services/lesson.quiz.service';
import { LessonService } from '../services/lesson.service';
import { LevelQuizQuestionService } from '../services/level.quiz.question.service';
import { LevelService } from '../services/level.service';
import { SchoolService } from '../services/school.service';
import { StudentService } from '../services/student.service';
import { TokenService } from '../services/token.service';
import { UtilService } from '../services/util.service';
import { SHARED_ZORRO_MODULES } from './shared-zorro.module';
import { LessonPlanService } from '../services/lesson.plan.service';
// #region third libs

const THIRDMODULES: any[] = [FontAwesomeModule, NgxSpinnerModule];

const sharedservices: any[] = [
  DocumentTagService,
  CurriculumService,
  GradeService,
  LevelService,
  LessonService,
  DocumentService,
  LevelQuizQuestionService,
  DropDownService,
  LessonPracticeService,
  LessonLearningService,
  LessonQuizService,
  LessonPlanService,
  StudentService,
  SchoolService,
];
// #endregion

// #region your componets & directives

const COMPONENTS: any[] = [];
const DIRECTIVES: any[] = [];

// #endregion

@NgModule({
  imports: [
    CommonModule,

    FormsModule,
    RouterModule,
    ReactiveFormsModule,
    ...SHARED_ZORRO_MODULES,
    // third libs
    ...THIRDMODULES,
    NgxChartsModule,
  ],
  declarations: [
    // your components
    ...COMPONENTS,
    ...DIRECTIVES,
  ],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    ...SHARED_ZORRO_MODULES,
    // third libs
    ...THIRDMODULES,

    // your components
    ...COMPONENTS,
    ...DIRECTIVES,
    NgxPermissionsModule,
    NgxChartsModule,
  ],
  providers: [
    // AuthService,
    UtilService,
    CoreService,
    TokenService,
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    ...sharedservices,
  ],
})
export class SharedModule {}
