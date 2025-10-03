import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { SharedModule } from 'src/app/shared/shared.module';
import { LevelCreateComponent } from './level-create/level-create.component';
import { LevelIndexComponent } from './level-index/level-index.component';
import { LevelRoutingModule } from './level-routing.module';
import { LevelUpdateComponent } from './level-update/level-update.component';
import { LevelQuizComponent } from './level-quiz/level-quiz.component';
import { SharedComponentsModule } from '../shared-modules/shared-components.module';


@NgModule({
  declarations: [
    LevelIndexComponent,
    LevelCreateComponent,
    LevelUpdateComponent,
    LevelQuizComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    LevelRoutingModule,
    SharedComponentsModule
  ],
  providers: [
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LevelModule { }
