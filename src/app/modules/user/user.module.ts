import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SharedModule } from 'src/app/shared/shared.module';
import { UserCreateComponent } from './user-create/user-create.component';
import { UserIndexComponent } from './user-index/user-index.component';
import { UserRoutingModule } from './user-routing.module';
import { UserUpdateComponent } from './user-update/user-update.component';

@NgModule({
  declarations: [UserCreateComponent, UserIndexComponent, UserUpdateComponent],
  imports: [CommonModule, SharedModule, UserRoutingModule],
})
export class UserModule {}
