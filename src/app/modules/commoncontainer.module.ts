import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SharedModule } from '../shared/shared.module';
import { CommonRoutingModule } from './common-routing.module';
import { CommonComponent } from './common.component';
import { StudentDetailsComponent } from './student/student-details/student-details.component';
import { AddLearnerDrawerComponent } from './student/add-learner/add-learner-drawer.component';
import { StudentIndexComponent } from './student/student-index/student-index.component';
import { StudentStatsComponent } from './student/student-stats/student-stats.component';
import { AddTeacherDrawerComponent } from './teacher/add-teacher/add-teacher-drawer.component';
import { EditLearnerDrawerComponent } from './student/edit-learner/edit-learner-drawer.component';
import { MoveLearnerDrawerComponent } from './student/move-learner/move-learner-drawer.component';
import { ResetPasswordDrawerComponent } from './student/reset-password/reset-password-drawer.component';
import { TeacherIndexComponent } from './teacher/teacher-index/teacher-index.component';
import { LessonModule } from "./lesson/lesson.module";
import { ShellBreadcrumbComponent } from './shell/shell-breadcrumb.component';
import { ShellIconComponent } from './shell/shell-icon.component';
import { OrgSwitcherComponent } from './shell/org-switcher.component';
import { ShellNavComponent } from './shell/shell-nav.component';

@NgModule({
    declarations: [
        CommonComponent,
        ShellNavComponent,
        OrgSwitcherComponent,
        ShellBreadcrumbComponent,
        ShellIconComponent,
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
        AddLearnerDrawerComponent,
        AddTeacherDrawerComponent,
        EditLearnerDrawerComponent,
        MoveLearnerDrawerComponent,
        ResetPasswordDrawerComponent,
    ]
})
export class CommonContainer {}
