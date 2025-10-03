import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SharedModule } from '../shared/shared.module';
import { CommonRoutingModule } from './common-routing.module';
import { CommonComponent } from './common.component';
import { StudentDetailsComponent } from './student/student-details/student-details.component';
import { StudentIndexComponent } from './student/student-index/student-index.component';
import { StudentStatsComponent } from './student/student-stats/student-stats.component';
import { TeacherIndexComponent } from './teacher/teacher-index/teacher-index.component';
import { LessonModule } from "./lesson/lesson.module";

@NgModule({
    declarations: [
        CommonComponent,
        StudentIndexComponent,
        TeacherIndexComponent,
        StudentStatsComponent,
        StudentDetailsComponent,
    ],
    imports: [
        CommonModule,
        // NgxPermissionsModule.forChild(),
        CommonRoutingModule,
        SharedModule,
    ]
})
export class CommonContainer {}
