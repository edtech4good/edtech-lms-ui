import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CountryRoutingModule } from './country-routing.module';
import { CountryCreateComponent } from './country-create/country-create.component';
import { SharedModule } from 'src/app/shared/shared.module';
import { NgxPermissionsModule } from 'ngx-permissions';
import { CountryIndexComponent } from './country-index/country-index.component';
import { CountryUpdateComponent } from './country-update/country-update.component';


@NgModule({
  declarations: [
    CountryCreateComponent,
    CountryIndexComponent,
    CountryUpdateComponent
  ],
  imports: [
    CommonModule,
    CountryRoutingModule,
    SharedModule,
    // NgxPermissionsModule.forChild(),
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CountryModule { }
