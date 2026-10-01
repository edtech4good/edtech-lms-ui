import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth-guard.service';
import { Role } from 'src/app/models/enums/role.enum';
import { ClassCompletedQuizComponent } from './class-completed-quiz/completed-quiz.component';
import { ClassLevelQuizComponent } from './class-level-quiz/level-quiz.component';
import { ReportIndexComponent } from './report-index/report-index.component';
import { StudentActivityComponent } from './student-activity/student-activity.component';
import { StudentCompletedQuizComponent } from './student-completed-quiz/completed-quiz.component';
import { StudentLastCompletedQuizComponent } from './student-last-completed-quiz/last-completed-quiz.component';
import { StudentLevelQuizComponent } from './student-level-quiz/level-quiz.component';
import { StudentGradeProgressComponent } from './student-progress/student-grade-progress/grade.component';
import { StudentLessonProgressComponent } from './student-progress/student-lesson-progress/lesson.component';
import { StudentLevelProgressComponent } from './student-progress/student-level-progress/level.component';
import { SyncRecordComponent } from './sync-record/sync-record.component';

const routes: Routes = [
  {
    path: '',
    children: [
      {
        // The Reports hub: links to every dashboard and report.
        path: '',
        pathMatch: 'full',
        component: ReportIndexComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'student-completed-quiz',
        component: StudentCompletedQuizComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Quiz scores',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'class-completed-quiz',
        component: ClassCompletedQuizComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Class quiz scores',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'class-completed-quiz/online',
        component: ClassCompletedQuizComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Class quiz scores (online)',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'student-completed-quiz/online',
        component: StudentCompletedQuizComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Quiz scores (online)',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'student-level-quiz',
        component: StudentLevelQuizComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Level quiz',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'class-level-quiz',
        component: ClassLevelQuizComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Class level quiz',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'class-level-quiz/online',
        component: ClassLevelQuizComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Class level quiz (online)',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'student-level-quiz/online',
        component: StudentLevelQuizComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Level quiz (online)',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'student-last-completed-quiz',
        component: StudentLastCompletedQuizComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Current level',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'student-last-completed-quiz/online',
        component: StudentLastCompletedQuizComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Current level (online)',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'student-activity',
        component: StudentActivityComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Active status',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'student-activity/online',
        component: StudentActivityComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Active status (online)',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'sync-record',
        component: SyncRecordComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Sync record',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'student-grade-progress',
        component: StudentGradeProgressComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Grade progress',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'student-grade-progress/online',
        component: StudentGradeProgressComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Grade progress (online)',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'student-level-progress',
        component: StudentLevelProgressComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Level progress',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'student-level-progress/online',
        component: StudentLevelProgressComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Level progress (online)',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'student-lesson-progress',
        component: StudentLessonProgressComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Lesson progress',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'student-lesson-progress/online',
        component: StudentLessonProgressComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Lesson progress (online)',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReportRoutingModule {}
