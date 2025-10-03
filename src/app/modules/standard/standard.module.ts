import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { SharedModule } from 'src/app/shared/shared.module';
import { StandardCreateComponent } from './standard-create/standard-create.component';
import { StandardIndexComponent } from './standard-index/standard-index.component';
import { StandardRoutingModule } from './standard-routing.module';
import { StandardUpdateComponent } from './standard-update/standard-update.component';

@NgModule({
  declarations: [StandardCreateComponent, StandardIndexComponent, StandardUpdateComponent],
  imports: [CommonModule, SharedModule, StandardRoutingModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class StandardModule {}
