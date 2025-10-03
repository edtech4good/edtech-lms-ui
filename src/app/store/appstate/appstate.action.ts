import { createAction } from '@ngrx/store';

export enum appStateActionTypes {
  setloading = '[appStateAction] Set App Loading',
  unsetloading = '[appStateAction] unSet App Loading',
}

export const setloadingAction = createAction(appStateActionTypes.setloading);
export const unsetloadingAction = createAction(appStateActionTypes.unsetloading);

