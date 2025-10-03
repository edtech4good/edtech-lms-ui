import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { StudentRoutingModule } from './student-routing.module';


@NgModule({
  declarations: [
  ],
  imports: [
    CommonModule,
    StudentRoutingModule,
    // NgxPermissionsModule.forChild(),
  ],
})
export class StudentModule {}
