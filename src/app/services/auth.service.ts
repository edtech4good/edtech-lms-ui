import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Store } from '@ngrx/store';
import { differenceInMilliseconds } from 'date-fns';
import { NgxPermissionsService } from 'ngx-permissions';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable, defer, firstValueFrom } from 'rxjs';
import { finalize, first, tap } from 'rxjs/operators';
import { FIELD_ERRORS_INLINE, ISSUES_TOKENS } from '../interceptors/error-context';
import { ResetPasswordBody } from '../models/changepassword';
import { lmsuser } from '../models/lmsuser.model';
import { LoginRequestBody } from '../models/loginrequestbody';
import {
  clearuserAction,
  setusersuccessAction,
} from '../store/lmsuser/lmsuser.action';
import { lmsuserstate } from '../store/lmsuser/lmsuser.reducer';
import { CoreService } from './core.service';
import { clearListCaches } from './list-cache';
import { TokenService } from './token.service';

/** What the person is told when the session is over. One text, one key: notices that arrive together show once. */
export const SESSION_ENDED_MESSAGE = 'Your session ended. Sign in again.';
export const SESSION_ENDED_TOAST_KEY = 'http-401';

/** How long a refused call waits for the token updates in flight (a switch, a refresh) before it goes on without them. */
export const TOKEN_UPDATE_WAIT_MS = 20_000;

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
    private readonly notification: NzNotificationService,
  ) {
    this.setAuthTimer();
  }

  private setAuthTimer() {
    const token = this.tokenService.gettoken();
    if (
      this.jwtHelper.getTokenExpirationDate(token) !== null &&
      this.jwtHelper.getTokenExpirationDate(token) !== undefined
    ) {
      clearTimeout(this.tokenTimer);
      const tokendifference = differenceInMilliseconds(
        this.jwtHelper.getTokenExpirationDate(token) || new Date(),
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
    // A refresh a refused call started is already asking with this refresh token (and stores the new pair,
    // which sets the timer again): a second ask with it would be refused and end a good session.
    if (this.recovery) return;
    // A token update in flight from before the request goes out until the new pair is stored (or the
    // refresh failed): a call refused meanwhile waits for it rather than refreshing with a dying token.
    const update = this.beginTokenUpdate();
    try {
      // The same exchange a refused call uses: a refresh token the server refuses ends the session, but a
      // refresh that could not be asked (no connection, a 429, a server error) says nothing about it, so
      // the session is kept (the next refused call tries the refresh again).
      const outcome = await this.exchangeRefreshToken();
      if (outcome === 'refused') this.endSession();
    } finally {
      update.end();
    }
  };

  getuser(): lmsuser {
    const usertemp: lmsuser = this.jwtHelper.isTokenExpired(
      this.tokenService.gettoken()
    )
      ? <lmsuser>{
          firstname: '',
          lmsuserid: '',
          lmsusername: '',
          lmsuserrole: '',
          lastname: '',
        }
      : this.jwtHelper.decodeToken<lmsuser>(this.tokenService.gettoken()) ??
        <lmsuser>{};
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
    this.clearSession();
    this.routetoLogin();
  }

  /**
   * Forget the signed-in session here, without telling the server. For a session the API has
   * already refused (a 401): the token is dead, so calling auth/logout would only 401 again.
   */
  clearSession(): void {
    clearListCaches();
    this.userstore.dispatch(clearuserAction());
    clearTimeout(this.tokenTimer);
    this.tokenService.logout();
    this.isLoggedIn = false;
  }
  // login api call
  login(credentials: LoginRequestBody): Observable<any> {
    return this.http
      .post(
        `${this.coreService.CORE_API()}auth/login`,
        {
          ...credentials,
        },
        this.coreService.jsonhttpOptions
      )
      // A new session starts with no list kept from an earlier one (another account, another organisation).
      .pipe(tap(() => clearListCaches()));
  }

  /**
   * Platform users only: act as an organisation (or as none, for null). The API
   * reissues both tokens. The caller says what a refusal means, so the interceptor
   * stays quiet about the refusals the switcher shows itself (FIELD_ERRORS_INLINE
   * also covers 403) and still toasts 429, 500 and no connection.
   */
  switchOrganisation(organisationid: string | null): Observable<{ data: { accessToken: string; refreshToken: string } }> {
    // The server cancels the old tokens the moment it issues the new pair, so this is a token update in
    // flight from before the request goes out until the caller has stored the pair (its next handler runs
    // before the observable finishes) or the switch failed. The request carries its own update, so a 401 on
    // it does not wait for itself (and still waits for any other).
    return defer(() => {
      const update = this.beginTokenUpdate();
      return this.http
        .post<{ data: { accessToken: string; refreshToken: string } }>(
          `${this.coreService.CORE_API()}auth/organisation`,
          { organisationid },
          {
            ...this.coreService.jsonhttpOptions,
            context: new HttpContext().set(FIELD_ERRORS_INLINE, true).set(ISSUES_TOKENS, update.done),
          }
        )
        .pipe(finalize(update.end));
    });
  }

  /** Can this token be read at all (three parts, a JSON payload)? Checked before a reissued token is stored. */
  isReadableToken(token: unknown): boolean {
    try {
      if (typeof token !== 'string' || token.split('.').length !== 3) return false;
      const payload = this.jwtHelper.decodeToken(token) as Record<string, unknown> | null;
      return !!payload && typeof payload === 'object';
    } catch {
      return false;
    }
  }

  /**
   * The API no longer accepts the stored access token (a 401): try the refresh token once.
   * 'renewed': it gave a new pair (stored, as a refresh does). 'refused': the refresh token is no good either
   * (a 401, or an answer that cannot be read), so the session is gone. 'unavailable': the refresh could not be
   * asked (no connection, a 429, a server error), which says nothing about the session.
   */
  private async exchangeRefreshToken(): Promise<'renewed' | 'refused' | 'unavailable'> {
    try {
      const result = await firstValueFrom(this.refreshtoken(this.tokenService.getrefreshtoken()));
      // Both tokens must be readable before either is stored: an unreadable answer keeps the old
      // tokens and counts as a failed recovery.
      if (!this.isReadableToken(result?.data?.accessToken) || !this.isReadableToken(result?.data?.refreshToken)) {
        return 'refused';
      }
      this.setlogin(result.data.accessToken, result.data.refreshToken);
      return 'renewed';
    } catch (e) {
      return e instanceof HttpErrorResponse && e.status !== 401 ? 'unavailable' : 'refused';
    }
  }

  /** The token updates in flight (a refresh, an organisation switch): each ends when its new pair is stored or it failed. */
  private readonly tokenUpdates = new Set<Promise<void>>();

  /**
   * Register a token update as in flight, before its request goes out. `end` when it is over; `done` is the
   * promise that ends then, which the update's own request carries so it does not wait for itself.
   */
  private beginTokenUpdate(): { done: Promise<void>; end: () => void } {
    let resolve!: () => void;
    const done = new Promise<void>((r) => (resolve = r));
    this.tokenUpdates.add(done);
    return {
      done,
      end: () => {
        this.tokenUpdates.delete(done);
        resolve();
      },
    };
  }

  /**
   * Wait for the token updates in flight, except `own` (the caller's), for at most TOKEN_UPDATE_WAIT_MS in all.
   * An update that has not ended by then is taken to have done nothing: it is forgotten (so the next refused
   * call does not wait for it again) and the caller goes on to compare the token and refresh. If it does end
   * later and stores a pair, that pair is simply the stored one.
   */
  private async waitForTokenUpdates(own?: Promise<void>): Promise<void> {
    const deadline = Date.now() + TOKEN_UPDATE_WAIT_MS;
    for (;;) {
      const pending = [...this.tokenUpdates].filter((u) => u !== own);
      if (pending.length === 0) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timedOut = await Promise.race([
        Promise.all(pending).then(() => false),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(true), Math.max(0, deadline - Date.now()));
        }),
      ]);
      clearTimeout(timer);
      if (timedOut) {
        for (const u of pending) this.tokenUpdates.delete(u);
        return;
      }
    }
  }

  /** The refresh in flight, if any: calls refused together share it. */
  private recovery: Promise<boolean> | null = null;

  /**
   * A call the API refused with a 401 (the token it was sent with is `sentToken`). The server cancels the old
   * access and refresh tokens when it issues a new pair, so a call can be refused while a switch or a refresh
   * is about to store a good pair: wait for any token update in flight first, then compare. A token that
   * differs from the one the call was sent with is a good one: true, send the call again. Otherwise get the
   * session back with the refresh token, once however many calls were refused together.
   * True: the session is good, so the caller may send its call again. False: the call stays refused. The
   * session is ended (once, with its one notice) only when the refresh token is refused too; a refresh that
   * could not be asked leaves the session as it is. A caller never navigates for this.
   * `ownUpdate`: the refused call is itself a token update (the organisation switch); this is its update,
   * which it must not wait for (any other it still waits for). The wait is bounded (TOKEN_UPDATE_WAIT_MS):
   * an update that has not ended by then is taken to have changed nothing.
   */
  async recoverOrEndSession(sentToken: string, ownUpdate?: Promise<void>): Promise<boolean> {
    await this.waitForTokenUpdates(ownUpdate);
    const now = this.tokenService.gettoken();
    // Signed out meanwhile (the session was ended by an earlier refusal): nothing to recover.
    if (!now) return false;
    // A new pair has been stored since this call went out: send it again with the new one.
    if (now !== sentToken) return true;
    if (!this.recovery) {
      const update = this.beginTokenUpdate();
      const done = () => {
        this.recovery = null;
        update.end();
      };
      this.recovery = this.exchangeRefreshToken().then(
        (outcome) => {
          if (outcome === 'refused') this.endSession();
          done();
          return outcome === 'renewed';
        },
        (e) => {
          done();
          throw e;
        }
      );
    }
    return this.recovery;
  }

  /** The session is over and cannot be got back (a refused refresh token): clear it, go to sign-in, say so once. */
  endSession(): void {
    this.clearSession();
    this.router.navigateByUrl('/auth/login');
    this.notification.info(SESSION_ENDED_MESSAGE, '', { nzKey: SESSION_ENDED_TOAST_KEY });
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

  /**
   * Who the signed-in staff account is, in organisation terms, from the access token.
   * `isPlatform` is true only for a platform account that is not acting inside an
   * organisation (the token carries no organisationid): that caller chooses an
   * organisation for the accounts it creates; anyone else works inside their own.
   */
  staffScope(): { lmsuserid: string; isPlatform: boolean; organisationid: string | null } {
    const user = this.getLmsUser() ?? this.getuser();
    const organisationid = typeof user?.organisationid === 'string' ? user.organisationid : null;
    return {
      lmsuserid: user?.lmsuserid ?? '',
      isPlatform: user?.isplatform === true && organisationid === null,
      organisationid,
    };
  }
}
