import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth-guard.service';
import { Role } from 'src/app/models/enums/role.enum';
import { AppUsageComponent } from './app-usage/app-usage.component';
import { IndexComponent } from './index/index.component';
import { SchoolComponent } from './school/school.component';
import { SchoolContributeComponent } from './school-contribute/school-contribute.component';
import { TechDowntimeComponent } from './tech-downtime/tech-downtime.component';
import { DefaultComponent } from './default/default.component';

const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        redirectTo: 'default',
        pathMatch: 'full',
      },
      {
        path: 'default',
        component: DefaultComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Home',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'index',
        component: IndexComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Reach',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'school',
        component: SchoolComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Reach by school',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'app-usage',
        component: AppUsageComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Impact',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'school-contribute',
        component: SchoolContributeComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Fees collection',
          roles: [Role.admin, Role.superadmin, Role.user],
        },
      },
      {
        path: 'tech-downtime',
        component: TechDowntimeComponent,
        canActivate: [AuthGuard],
        data: {
          crumb: 'Tech downtime',
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
export class DashboardRoutingModule { }
