import { createReducer, on } from '@ngrx/store';
import { lmsuser } from 'src/app/models/lmsuser.model';
import { clearuserAction, setusersuccessAction } from './lmsuser.action';
export const usersStateKey = 'userState';

export class lmsuserstate {
  user?: lmsuser;
  constructor() {
    this.user = undefined;
  }
}

export const initialuserstate: lmsuserstate = new lmsuserstate();

export const userReducer = createReducer(
  initialuserstate,
  on(clearuserAction, (state) => ({
    ...state,
    ...initialuserstate,
  })),
  on(setusersuccessAction, (state, action: lmsuserstate) => ({
    ...state,
    user: action.user,
  })),

);
