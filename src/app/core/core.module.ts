import { NgModule, Optional, SkipSelf } from '@angular/core';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { userReducer, usersStateKey } from "./../store/lmsuser/lmsuser.reducer";
import { appStateReducer, appStateKey } from "./../store/appstate/appstate.reducer";
const effects: any[] = [
  //UsersEffects,
];

const StoreComponents = [
  StoreModule.forFeature(usersStateKey, userReducer),
  StoreModule.forFeature(appStateKey, appStateReducer),
  EffectsModule.forFeature([...effects]),
];

const SERVICES: any[] = [];

@NgModule({
  imports: [...StoreComponents],
  declarations: [],
  exports: [],
  providers: [...SERVICES],
})
export class CoreModule {

}
