import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../guards/auth-guard.service';
import { requirePermission } from '../guards/permission.guard';
import { CommonComponent } from './common.component';

const routes: Routes = [
  {
    path: '',
    component: CommonComponent,
    children: [
      {
        path: 'organisation',
        loadChildren: () => import('./organisation/organisation.routes').then((m) => m.ORGANISATION_ROUTES),
        canActivate: [AuthGuard, requirePermission('view_organisation')],
        data: {
          group: 'Platform',
          crumb: 'Organisations',
          crumbLink: '/organisation',
          role: [],
        },
      },
      {
        path: 'baseline-curriculum',
        loadChildren: () =>
          import('./baseline-curriculum/baseline-curriculum.module').then((m) => m.BaselineCurriculumModule),
        canActivate: [AuthGuard],
        data: {
          group: 'Content',
          crumb: 'Assessments',
          crumbLink: '/baseline-curriculum/index',
          role: [],
        },
      },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./dashboard/dashboard.module').then((m) => m.DashboardModule),
        canActivate: [AuthGuard],
        data: {
          group: 'Reports and settings',
          crumb: 'Reports',
          crumbLink: '/report',
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
          group: 'Administration',
          crumb: 'Media tags',
          crumbLink: '/documenttag/index',
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
          group: 'Administration',
          crumb: 'Question tags',
          crumbLink: '/questiontag/index',
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
          group: 'Administration',
          crumb: 'Subjects',
          crumbLink: '/subject/index',
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
          group: 'Content',
          crumb: 'Curricula',
          crumbLink: '/curriculum/index',
          role: [],
        },
      },
      {
        path: 'grade',
        loadChildren: () =>
          import('./grade/grade.module').then((m) => m.GradeModule),
        canActivate: [AuthGuard],
        data: {
          group: 'Content',
          crumb: 'Grades',
          crumbLink: '/grade/index',
          role: [],
        },
      },
      {
        path: 'level',
        loadChildren: () =>
          import('./level/level.module').then((m) => m.LevelModule),
        canActivate: [AuthGuard],
        data: {
          group: 'Content',
          crumb: 'Levels',
          crumbLink: '/level/index',
          role: [],
        },
      },
      {
        path: 'map',
        loadChildren: () => import('./map/map.module').then((m) => m.MapModule),
        canActivate: [AuthGuard],
        data: {
          group: 'Content',
          crumb: 'Map',
          crumbLink: '/map/index',
          role: [],
        },
      },
      {
        path: 'lesson',
        loadChildren: () =>
          import('./lesson/lesson.module').then((m) => m.LessonModule),
        canActivate: [AuthGuard],
        data: {
          group: 'Content',
          crumb: 'Lessons',
          crumbLink: '/lesson/index',
          role: [],
        },
      },
      {
        path: 'document',
        loadChildren: () =>
          import('./document/document.module').then((m) => m.DocumentModule),
        canActivate: [AuthGuard],
        data: {
          group: 'Content',
          crumb: 'Media',
          crumbLink: '/document/index',
          role: [],
        },
      },
      {
        path: 'question',
        loadChildren: () =>
          import('./question/question.module').then((m) => m.QuestionModule),
        canActivate: [AuthGuard],
        data: {
          group: 'Content',
          crumb: 'Questions',
          crumbLink: '/question/index',
          role: [],
        },
      },
      {
        path: 'student',
        loadChildren: () =>
          import('./student/student.module').then((m) => m.StudentModule),
        canActivate: [AuthGuard],
        data: {
          group: 'People',
          crumb: 'Learners',
          crumbLink: '/student/index',
          role: [],
        },
      },
      {
        path: 'teacher',
        loadChildren: () =>
          import('./teacher/teacher.module').then((m) => m.TeacherModule),
        canActivate: [AuthGuard],
        data: {
          group: 'People',
          crumb: 'Teachers',
          crumbLink: '/teacher/index',
          role: [],
        },
      },
      {
        path: 'school',
        loadChildren: () =>
          import('./school/school.module').then((m) => m.SchoolModule),
        canActivate: [AuthGuard],
        data: {
          group: 'People',
          crumb: 'Schools',
          crumbLink: '/school/index',
          role: [],
        },
      },
      {
        path: 'standard',
        loadChildren: () =>
          import('./standard/standard.module').then((m) => m.StandardModule),
        canActivate: [AuthGuard],
        data: {
          group: 'People',
          crumb: 'Classes',
          crumbLink: '/standard/index',
          role: [],
        },
      },
      {
        path: 'country',
        loadChildren: () =>
          import('./country/country.module').then((m) => m.CountryModule),
        canActivate: [AuthGuard],
        data: {
          group: 'Administration',
          crumb: 'Countries',
          crumbLink: '/country/index',
          role: [],
        },
      },
      {
        path: 'role-perm',
        loadChildren: () =>
          import('./role-permission/role.module').then((m) => m.RolePermissionModule),
        canActivate: [AuthGuard],
        data: {
          group: 'Administration',
          crumb: 'Roles',
          crumbLink: '/role-perm/index',
          role: [],
        },
      },
      {
        path: 'user',
        loadChildren: () =>
          import('./user/user.module').then((m) => m.UserModule),
        canActivate: [AuthGuard],
        data: {
          group: 'Administration',
          crumb: 'Staff accounts',
          crumbLink: '/user/index',
          role: [],
        },
      },
      {
        path: 'feedback',
        loadChildren: () =>
          import('./feedback/feedback.module').then((m) => m.FeedbackModule),
        canActivate: [AuthGuard],
        data: {
          group: 'Administration',
          crumb: 'Feedback',
          crumbLink: '/feedback/index',
          role: [],
        },
      },
      {
        path: 'report',
        loadChildren: () =>
          import('./report/report.module').then((m) => m.ReportModule),
        canActivate: [AuthGuard],
        data: {
          group: 'Reports and settings',
          crumb: 'Reports',
          crumbLink: '/report',
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
