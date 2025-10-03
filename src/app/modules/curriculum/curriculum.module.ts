import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SharedModule } from 'src/app/shared/shared.module';
import { CurriculumCreateComponent } from './curriculum-create/curriculum-create.component';
import { CurriculumIndexComponent } from './curriculum-index/curriculum-index.component';
import { CurriculumRoutingModule } from './curriculum-routing.module';
import { CurriculumUpdateComponent } from './curriculum-update/curriculum-update.component';

@NgModule({
  declarations: [
    CurriculumIndexComponent,
    CurriculumCreateComponent,
    CurriculumUpdateComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    // NgxPermissionsModule.forChild(),
    CurriculumRoutingModule,
  ],
  providers: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CurriculumModule {}
