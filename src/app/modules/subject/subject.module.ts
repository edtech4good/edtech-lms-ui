import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SharedModule } from 'src/app/shared/shared.module';
import { SubjectCreateComponent } from './subject-create/subject-create.component';
import { SubjectIndexComponent } from './subject-index/subject-index.component';
import { SubjectRoutingModule } from './subject-routing.module';
import { SubjectUpdateComponent } from './subject-update/subject-update.component';

@NgModule({
  declarations: [
    SubjectIndexComponent,
    SubjectCreateComponent,
    SubjectUpdateComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    // NgxPermissionsModule.forChild(),
    SubjectRoutingModule,
  ],
  providers: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SubjectModule {}
