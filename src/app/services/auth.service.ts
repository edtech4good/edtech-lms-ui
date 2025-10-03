import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Store } from '@ngrx/store';
import { differenceInMilliseconds } from 'date-fns';
import { NgxPermissionsService } from 'ngx-permissions';
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';
import { ResetPasswordBody } from '../models/changepassword';
import { lmsuser } from '../models/lmsuser.model';
import { LoginRequestBody } from '../models/loginrequestbody';
import {
  clearuserAction,
  setusersuccessAction,
} from '../store/lmsuser/lmsuser.action';
import { lmsuserstate } from '../store/lmsuser/lmsuser.reducer';
import { CoreService } from './core.service';
import { TokenService } from './token.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private tokenTimer: any;
  isLoggedIn = false;
  autherisationcheck = false;
  lmsuser: lmsuser | null = null;
  constructor(
    private permissionsService: NgxPermissionsService,
    private readonly http: HttpClient,
    private readonly jwtHelper: JwtHelperService,
    private readonly tokenService: TokenService,
    private readonly coreService: CoreService,
    private readonly userstore: Store<lmsuserstate>,
    private readonly router: Router,
    private route: ActivatedRoute,
  ) {
    this.setAuthTimer();
  }

  private setAuthTimer() {
    if (
      this.jwtHelper.getTokenExpirationDate() !== null &&
      this.jwtHelper.getTokenExpirationDate() !== undefined
    ) {
      clearTimeout(this.tokenTimer);
      const tokendifference = differenceInMilliseconds(
        this.jwtHelper.getTokenExpirationDate() || new Date(),
        new Date()
      );
      if (tokendifference > 10000) {
        this.tokenTimer = setTimeout(() => {
          this.fetchrefreshtoken();
        }, tokendifference - 10000);

        const temp = new lmsuserstate();
        temp.user = (this.getLmsUser() ? this.getLmsUser() : this.getuser()) ?? undefined;
        this.userstore.dispatch(setusersuccessAction(temp));
      } else if (tokendifference > 3000 && tokendifference <= 10000) {
        this.fetchrefreshtoken();
      } else {
        this.logout();
      }
    } else {
      this.logout();
    }
  }
  routetoLogin = () => {
    if (!this.coreService.ignoreToken()) {
      this.router.navigateByUrl('/auth/login');
    }
  };
  validatelogin() {
    this.setAuthTimer();
  }
  setlogin(accessToken: string, refreshToken: string) {
    this.tokenService.savetoken(accessToken);
    this.tokenService.saverefreshtoken(refreshToken);
    this.setAuthTimer();
    // this.permissionsService.loadPermissions([this.getuser().lmsuserrole]);
    this.setLmsUser(this.getuser());
    this.permissionsService.loadPermissions(this.getLmsUser()?.permissions ?? []);
  }
  private fetchrefreshtoken = async () => {
    try {
      const result = await this.refreshtoken(
        this.tokenService.getrefreshtoken()
      ).toPromise();
      this.setlogin(result.data.accessToken, result.data.refreshToken);
    } catch (e) {
      this.logout();
    }
  };

  getuser(): lmsuser {
    const usertemp: lmsuser = this.jwtHelper.isTokenExpired()
      ? <lmsuser>{
          firstname: '',
          lmsuserid: '',
          lmsusername: '',
          lmsuserrole: '',
          lastname: '',
        }
      : this.jwtHelper.decodeToken<lmsuser>(this.tokenService.gettoken());
    this.isLoggedIn = true;
    return usertemp;
  }

  checkRole(role: string | Array<string>): boolean {
    try {
      const user = this.getLmsUser() ? this.getLmsUser() : this.getuser();
      if (Array.isArray(role)) {
        return role.find((x) => x === user?.lmsuserrole)
          ? true
          : false;
      } else {
        return role === user?.lmsuserrole;
      }
    } catch {
      return false;
    }
  }

  logout(): void {
    this.serverlogout().pipe(first()).subscribe();
    this.userstore.dispatch(clearuserAction());
    clearTimeout(this.tokenTimer);
    this.tokenService.logout();
    this.isLoggedIn = false;
    this.routetoLogin();
  }
  // login api call
  login(credentials: LoginRequestBody): Observable<any> {
    return this.http.post(
      `${this.coreService.CORE_API()}auth/login`,
      {
        ...credentials,
      },
      this.coreService.jsonhttpOptions
    );
  }

  // refresh token api call
  refreshtoken(refreshtoken: string): Observable<any> {
    return this.http.post(
      `${this.coreService.CORE_API()}auth/refreshtoken?refreshtoken=${refreshtoken}`,
      this.coreService.jsonhttpOptions
    );
  }

  // change password api call
  changepassword(credentialspassword: ResetPasswordBody, token: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}auth/changepassword?changepasswordtoken=${token}`,
      {
        ...credentialspassword,
      },
      this.coreService.jsonhttpOptions
    );
  }
  // change active token  api call
  verify(activatetoken: string) {
    return this.http.post(
      `${this.coreService.CORE_API()}auth/verify?verifyemailtoken=${activatetoken}`,
      this.coreService.jsonhttpOptions
    );
  }
  // forgot password api call
  forgotpassword(lmsusername: string) {
    return this.http.post(
      `${this.coreService.CORE_API()}auth/forgotpassword`,
      {
        lmsusername,
      },
      this.coreService.jsonhttpOptions
    );
  }

  validatechangepassword = (changepasswordtoken: string) =>
    this.http.post(
      `${this.coreService.CORE_API()}auth/token/validate/changepassword?changepasswordtoken=${changepasswordtoken}`,
      this.coreService.jsonhttpOptions
    );

  validateverify = (verifyemailtoken: string) =>
    this.http.post(
      `${this.coreService.CORE_API()}auth/token/validate/verify?verifyemailtoken=${verifyemailtoken}`,
      this.coreService.jsonhttpOptions
    );

  private serverlogout() {
    return this.http.post(
      `${this.coreService.CORE_API()}auth/logout`,
      this.coreService.jsonhttpOptions
    );
  }

  setLmsUser(user: lmsuser | null){
    this.lmsuser = user;
  }

  getLmsUser(){
    return this.lmsuser;
  }
}
