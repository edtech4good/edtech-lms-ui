import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../guards/auth-guard.service';
import { CommonComponent } from './common.component';

const routes: Routes = [
  {
    path: '',
    component: CommonComponent,
    children: [
      {
        path: 'baseline-curriculum',
        loadChildren: () =>
          import('./baseline-curriculum/baseline-curriculum.module').then((m) => m.BaselineCurriculumModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./dashboard/dashboard.module').then((m) => m.DashboardModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'documenttag',
        loadChildren: () =>
          import('./document-tag/document-tag.module').then(
            (m) => m.DocumentTagModule
          ),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'questiontag',
        loadChildren: () =>
          import('./question-tag/question-tag.module').then(
            (m) => m.QuestionTagModule
          ),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'subject',
        loadChildren: () =>
          import('./subject/subject.module').then(
            (m) => m.SubjectModule
          ),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'curriculum',
        loadChildren: () =>
          import('./curriculum/curriculum.module').then(
            (m) => m.CurriculumModule
          ),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'grade',
        loadChildren: () =>
          import('./grade/grade.module').then((m) => m.GradeModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'level',
        loadChildren: () =>
          import('./level/level.module').then((m) => m.LevelModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'map',
        loadChildren: () => import('./map/map.module').then((m) => m.MapModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'lesson',
        loadChildren: () =>
          import('./lesson/lesson.module').then((m) => m.LessonModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'document',
        loadChildren: () =>
          import('./document/document.module').then((m) => m.DocumentModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'question',
        loadChildren: () =>
          import('./question/question.module').then((m) => m.QuestionModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'student',
        loadChildren: () =>
          import('./student/student.module').then((m) => m.StudentModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'teacher',
        loadChildren: () =>
          import('./teacher/teacher.module').then((m) => m.TeacherModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'school',
        loadChildren: () =>
          import('./school/school.module').then((m) => m.SchoolModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'standard',
        loadChildren: () =>
          import('./standard/standard.module').then((m) => m.StandardModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'country',
        loadChildren: () =>
          import('./country/country.module').then((m) => m.CountryModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'role-perm',
        loadChildren: () =>
          import('./role-permission/role.module').then((m) => m.RolePermissionModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'user',
        loadChildren: () =>
          import('./user/user.module').then((m) => m.UserModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'feedback',
        loadChildren: () =>
          import('./feedback/feedback.module').then((m) => m.FeedbackModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
      {
        path: 'report',
        loadChildren: () =>
          import('./report/report.module').then((m) => m.ReportModule),
        canActivate: [AuthGuard],
        data: {
          role: [],
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CommonRoutingModule {}
