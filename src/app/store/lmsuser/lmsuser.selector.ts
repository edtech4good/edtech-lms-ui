import { createFeatureSelector, createSelector } from '@ngrx/store';
import { usersStateKey, lmsuserstate } from './lmsuser.reducer';
export const selectuserState = createFeatureSelector<lmsuserstate>(usersStateKey);

export const getuser = createSelector(
  selectuserState,
  (state: lmsuserstate) => state.user
);

export const getusersubcription = createSelector(
  selectuserState,
  (state: lmsuserstate): any => state.user
);
