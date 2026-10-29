import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MapRoutingModule } from './map-routing.module';
import { MapIndexComponent } from './map-index/map-index.component';
import { PublicationPillComponent } from 'src/app/shared/publication/publication-pill.component';
import { SharedModule } from 'src/app/shared/shared.module';


@NgModule({
  declarations: [
    MapIndexComponent
  ],
  imports: [
    CommonModule, SharedModule, PublicationPillComponent,
    MapRoutingModule
  ]
})
export class MapModule { }
