import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth-guard.service';
import { Role } from 'src/app/models/enums/role.enum';
import { LessonCreateComponent } from './lesson-create/lesson-create.component';
import { LessonIndexComponent } from './lesson-index/lesson-index.component';
import { LessonLearningComponent } from './lesson-learning/lesson-learning.component';
import { LessonPracticeQuestionsComponent } from './lesson-practice-questions/lesson-practice-questions.component';
import { LessonPracticeComponent } from './lesson-practice/lesson-practice.component';
import { LessonQuizQuestionsComponent } from './lesson-quiz-questions/lesson-quiz-questions.component';
import { LessonQuizComponent } from './lesson-quiz/lesson-quiz.component';
import { LessonUpdateComponent } from './lesson-update/lesson-update.component';
import { LessonPlanComponent } from './lesson-plan/lesson-plan.component';

const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        redirectTo: 'index',
        pathMatch: 'full',
      },
      {
        path: 'index',
        component: LessonIndexComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'create',
        component: LessonCreateComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'update/:lessonid',
        component: LessonUpdateComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'learning/:lessonid',
        component: LessonLearningComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'practice/:lessonid',
        component: LessonPracticeComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'practice/question/:lessonpracticeid',
        component: LessonPracticeQuestionsComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'quiz/:lessonid',
        component: LessonQuizComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'quiz/question/:lessonquizid',
        component: LessonQuizQuestionsComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'teacher-plan/:lessonid',
        component: LessonPlanComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
    ],
  },
];


@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LessonRoutingModule { }
