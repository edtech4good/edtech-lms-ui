import { ActionReducerMap, MetaReducer } from '@ngrx/store';
import { environment } from '../../environments/environment';

export interface State {
  SERVER_URL?: string;
  production?: boolean;
  useHash?: boolean;
  hmr?: boolean;
}

export const reducers: ActionReducerMap<State> = {};

export const metaReducers: MetaReducer<State>[] = !environment.production
  ? []
  : [];
