import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth-guard.service';
import { Role } from 'src/app/models/enums/role.enum';
import { UserCreateComponent } from './user-create/user-create.component';
import { UserIndexComponent } from './user-index/user-index.component';
import { UserUpdateComponent } from './user-update/user-update.component';

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
        component: UserIndexComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'create',
        component: UserCreateComponent,
        canActivate: [AuthGuard],
        data: {
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'update/:lmsuserid',
        component: UserUpdateComponent,
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
  exports: [RouterModule],
})
export class UserRoutingModule {}
