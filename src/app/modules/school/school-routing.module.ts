import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth-guard.service';
import { Role } from 'src/app/models/enums/role.enum';
import { SchoolCreateComponent } from './school-create/school-create.component';
import { SchoolIndexComponent } from './school-index/school-index.component';
import { SchoolUpdateComponent } from './school-update/school-update.component';
import { SchoolCreateContributeComponent } from './schoolcontribute-create/schoolcontribute-create.component';
import { SchoolcontributeComponent } from './schoolcontribute/schoolcontribute.component';
import { SchoolcontributeUpdateComponent } from './schoolcontribute-update/schoolcontribute-update.component';

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
        component: SchoolIndexComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'create',
        component: SchoolCreateComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'update/:schoolid',
        component: SchoolUpdateComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'schoolcontribute/:schoolid',
        component: SchoolcontributeComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'schoolcontribute-create/:schoolid',
        component: SchoolCreateContributeComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'schoolcontribute-update/:schoolcontributeid',
        component: SchoolcontributeUpdateComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        }
      }
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SchoolRoutingModule {}
