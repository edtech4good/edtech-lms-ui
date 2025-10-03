import { createFeatureSelector, createSelector } from '@ngrx/store';
import { appStateKey, appState } from './appstate.reducer';
export const selectuserState = createFeatureSelector<appState>(appStateKey);

export const getappLoading = createSelector(
  selectuserState,
  (state: appState) => state.loading
);
