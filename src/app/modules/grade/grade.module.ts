import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { SharedModule } from 'src/app/shared/shared.module';
import { GradeCreateComponent } from './grade-create/grade-create.component';
import { GradeIndexComponent } from './grade-index/grade-index.component';
import { GradeRoutingModule } from './grade-routing.module';
import { GradeUpdateComponent } from './grade-update/grade-update.component';


@NgModule({
  declarations: [
    GradeIndexComponent,
    GradeCreateComponent,
    GradeUpdateComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    GradeRoutingModule
  ],
  providers: [
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class GradeModule { }
