import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RoleRoutingModule } from './role-routing.module';
import { RoleCreateComponent } from './role-create/role-create.component';
import { RoleIndexComponent } from './role-index/role-index.component';
import { RoleUpdateComponent } from './role-update/role-update.component';
import { SharedModule } from 'src/app/shared/shared.module';


@NgModule({
  declarations: [
    RoleCreateComponent,
    RoleIndexComponent,
    RoleUpdateComponent
  ],
  imports: [
    CommonModule,
    RoleRoutingModule,
    SharedModule,
    // NgxPermissionsModule.forChild(),
  ]
})
export class RolePermissionModule { }
