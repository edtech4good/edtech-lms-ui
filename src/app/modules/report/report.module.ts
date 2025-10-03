import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SharedModule } from 'src/app/shared/shared.module';
import { ClassCompletedQuizComponent } from './class-completed-quiz/completed-quiz.component';
import { ClassLevelQuizComponent } from './class-level-quiz/level-quiz.component';
import { ReportRoutingModule } from './report-routing.module';
import { StudentActivityComponent } from './student-activity/student-activity.component';
import { StudentCompletedQuizComponent } from './student-completed-quiz/completed-quiz.component';
import { StudentLastCompletedQuizComponent } from './student-last-completed-quiz/last-completed-quiz.component';
import { StudentLevelQuizComponent } from './student-level-quiz/level-quiz.component';
import { StudentGradeProgressComponent } from './student-progress/student-grade-progress/grade.component';
import { StudentLessonProgressComponent } from './student-progress/student-lesson-progress/lesson.component';
import { StudentLevelProgressComponent } from './student-progress/student-level-progress/level.component';
import { SyncRecordComponent } from './sync-record/sync-record.component';

@NgModule({
  declarations: [
    StudentCompletedQuizComponent,
    ClassCompletedQuizComponent,
    StudentLevelQuizComponent,
    ClassLevelQuizComponent,
    StudentLastCompletedQuizComponent,
    StudentActivityComponent,
    SyncRecordComponent,
    StudentGradeProgressComponent,
    StudentLevelProgressComponent,
    StudentLessonProgressComponent,
  ],
  imports: [CommonModule, SharedModule, ReportRoutingModule],
})
export class ReportModule {}
