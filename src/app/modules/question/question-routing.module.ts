import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth-guard.service';
import { Role } from 'src/app/models/enums/role.enum';
import { QuestionCreateComponent } from './question-create/question-create.component';
import { QuestionIndexComponent } from './question-index/question-index.component';
import { QuestionUpdateComponent } from './question-update/question-update.component';

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
        component: QuestionIndexComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'create',
        component: QuestionCreateComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'update/:questionid',
        component: QuestionUpdateComponent,
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
export class QuestionRoutingModule { }
