import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth-guard.service';
import { Role } from 'src/app/models/enums/role.enum';
import { QuestionTagCreateComponent } from './question-tag-create/question-tag-create.component';
import { QuestionTagIndexComponent } from './question-tag-index/question-tag-index.component';
import { QuestionTagUpdateComponent } from './question-tag-update/question-tag-update.component';

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
        component: QuestionTagIndexComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'create',
        component: QuestionTagCreateComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'update/:questiontagid',
        component: QuestionTagUpdateComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      }
    ],
  },
];


@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class QuestionTagRoutingModule { }
