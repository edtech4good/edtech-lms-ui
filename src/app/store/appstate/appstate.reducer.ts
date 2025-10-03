import { createReducer, on } from '@ngrx/store';
import { setloadingAction, unsetloadingAction } from './appstate.action';
export const appStateKey = 'appState';

export class appState {
  loading: boolean = false;
  constructor() {
    this.loading = false;
  }
}

export const initialappState: appState = new appState();

export const appStateReducer = createReducer(
  initialappState,
  on(setloadingAction, (state) => ({
    ...state,
    loading: true,
  })),
  on(unsetloadingAction, (state) => ({
    ...state,
    loading: false,
  })),
);
