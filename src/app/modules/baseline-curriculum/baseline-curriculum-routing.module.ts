import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth-guard.service';
import { Role } from 'src/app/models/enums/role.enum';
import { BaselineCurriculumCreateComponent } from './baseline-curriculum-create/baseline-curriculum-create.component';
import { BaselineCurriculumIndexComponent } from './baseline-curriculum-index/baseline-curriculum-index.component';
import { BaselineCurriculumUpdateComponent } from './baseline-curriculum-update/baseline-curriculum-update.component';
import { BaselinequestionIndexComponent } from './baselinequestion-index/baselinequestion-index.component';
import { BaselineCurriculumSchoolComponent } from './baseline-curriculum-school/baseline-curriculum-school.component';

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
        component: BaselineCurriculumIndexComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'create',
        component: BaselineCurriculumCreateComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'update/:curriculumbaselineid',
        component: BaselineCurriculumUpdateComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'baselinequestion-index/:curriculumbaselineid',
        component: BaselinequestionIndexComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'baselineschool/:curriculumbaselineid',
        component: BaselineCurriculumSchoolComponent,
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
export class BaselineCurriculumRoutingModule { }
