import { createAction, props } from '@ngrx/store';
import { lmsuserstate } from './lmsuser.reducer';

export enum userActionTypes {
  setuseruccess = '[lmsuserAction] Set lmsuser Success ',
  clearuser = '[lmsuserAction] Clear lmsuser',
}

export const setusersuccessAction = createAction(
  userActionTypes.setuseruccess,
  props<lmsuserstate>()
);
export const clearuserAction = createAction(userActionTypes.clearuser);

