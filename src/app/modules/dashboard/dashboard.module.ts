import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DashboardRoutingModule } from './dashboard-routing.module';
import { IndexComponent } from './index/index.component';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { SchoolComponent } from './school/school.component';
import { SharedModule } from 'src/app/shared/shared.module';
import { AppUsageComponent } from './app-usage/app-usage.component';
import { SchoolContributeComponent } from './school-contribute/school-contribute.component';
import { TechDowntimeComponent } from './tech-downtime/tech-downtime.component';
import { DefaultComponent } from './default/default.component';


@NgModule({
  declarations: [
    DefaultComponent,
    IndexComponent,
    SchoolComponent,
    AppUsageComponent,
    SchoolContributeComponent,
    TechDowntimeComponent,
  ],
  imports: [
    CommonModule,
    DashboardRoutingModule,
    NgxChartsModule,
    SharedModule,
  ]
})
export class DashboardModule { }
