import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BaselineCurriculumRoutingModule } from './baseline-curriculum-routing.module';
import { SharedModule } from 'src/app/shared/shared.module';
import { NgxPermissionsModule } from 'ngx-permissions';
import { BaselineCurriculumUpdateComponent } from './baseline-curriculum-update/baseline-curriculum-update.component';
import { BaselineCurriculumIndexComponent } from './baseline-curriculum-index/baseline-curriculum-index.component';
import { BaselineCurriculumCreateComponent } from './baseline-curriculum-create/baseline-curriculum-create.component';
import { BaselinequestionIndexComponent } from './baselinequestion-index/baselinequestion-index.component';
import { SharedComponentsModule } from "../shared-modules/shared-components.module";
import { BaselineCurriculumSchoolComponent } from './baseline-curriculum-school/baseline-curriculum-school.component';


@NgModule({
    declarations: [
        BaselineCurriculumIndexComponent,
        BaselineCurriculumCreateComponent,
        BaselineCurriculumUpdateComponent,
        BaselinequestionIndexComponent,
        BaselineCurriculumSchoolComponent
    ],
    imports: [
        CommonModule,
        SharedModule,
        // NgxPermissionsModule.forChild(),
        BaselineCurriculumRoutingModule,
        SharedComponentsModule
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class BaselineCurriculumModule { }
