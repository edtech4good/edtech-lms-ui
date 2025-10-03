import {
  HttpHandler, HttpInterceptor, HttpRequest
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { CoreService } from '../services/core.service';
import { TokenService } from '../services/token.service';
import { setloadingAction } from '../store/appstate/appstate.action';
import { appState } from '../store/appstate/appstate.reducer';

const TOKEN_HEADER_KEY = 'Authorization';
@Injectable({ providedIn: "root" })
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private readonly tokenService: TokenService,
    private route: ActivatedRoute,
    private coreService: CoreService,
    private appStore: Store<appState>
  ) { }

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    this.appStore.dispatch(setloadingAction());
    let authReq = req;
    const token = this.tokenService.gettoken();
    if (token != null) {
      if (!this.coreService.ignoreToken()) {
        authReq = req.clone({
          headers: req.headers
            .set(TOKEN_HEADER_KEY, `bearer ${token}`)
            .set('TIMEOFFSET', `${new Date().getTimezoneOffset()}`),
        });
      }

    }
    return next.handle(authReq);
  }
}
