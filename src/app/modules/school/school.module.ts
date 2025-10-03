import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SharedModule } from 'src/app/shared/shared.module';
import { SchoolCreateComponent } from './school-create/school-create.component';
import { SchoolIndexComponent } from './school-index/school-index.component';
import { SchoolRoutingModule } from './school-routing.module';
import { SchoolUpdateComponent } from './school-update/school-update.component';
import { SchoolCreateContributeComponent } from './schoolcontribute-create/schoolcontribute-create.component';
import { SchoolcontributeComponent } from './schoolcontribute/schoolcontribute.component';
import { SchoolcontributeUpdateComponent } from './schoolcontribute-update/schoolcontribute-update.component';

@NgModule({
  declarations: [
    SchoolCreateComponent,
    SchoolIndexComponent,
    SchoolUpdateComponent,
    SchoolCreateContributeComponent,
    SchoolcontributeComponent,
    SchoolcontributeUpdateComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    SchoolRoutingModule,
    // NgxPermissionsModule.forChild(),
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SchoolModule {}
