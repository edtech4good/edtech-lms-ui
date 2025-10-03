import { Store } from '@ngrx/store';
import { Injectable } from '@angular/core';
import { lmsuserstate } from 'src/app/store/lmsuser/lmsuser.reducer';

@Injectable()
export class StartupService {
  constructor(private clientstore: Store<lmsuserstate>) { }

  load() {
    //this.clientstore.dispatch(getclientAction());
  }
}
