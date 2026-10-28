import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { CoreService } from '../services/core.service';
import { TokenService } from '../services/token.service';
import { unsetloadingAction } from '../store/appstate/appstate.action';
import { appState } from '../store/appstate/appstate.reducer';
import { FAILURES_SHOWN_BY_CALLER, FIELD_ERRORS_INLINE, FORBIDDEN_HANDLED, GATEWAY_HANDLED, ISSUES_TOKENS, NOT_FOUND_HANDLED } from './error-context';

/** What a 404 says when the API gave no words of its own. */
export const NOT_FOUND_MESSAGE = 'That record was not found. It may have been removed, or it may not be yours to see.';

/** The ng-zorro key of the 404 notice: a repeat replaces the one showing. */
export const NOT_FOUND_TOAST_KEY = 'http-404';

/**
 * A 401 on these is not an ended session. The sign-in call answers it for the form (a wrong
 * password), a logout and a refresh are made with a token that is already dead, and the
 * refresh's failure is read by whoever asked for it.
 */
const SESSION_FREE_URL = /\/auth\/(login|logout|refreshtoken)(\?|$)/;

/** What a 502 or 503 says when the API gave no words of its own (a proxy's page, an empty body). */
export const GATEWAY_MESSAGE = 'The service is temporarily unavailable. Try again in a few minutes.';

/**
 * What to tell the person about a 502 or 503: the API's own sentence, its hint and its reference when it sent them,
 * the generic line when it did not (a proxy's page, an empty body). The error interceptor's gateway notice and any
 * caller that says a refused action itself (the organisation list's row actions) use this one text.
 */
export function gatewayText(error: HttpErrorResponse): string {
  const body = error?.error;
  const word = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  const said = word(body?.errormessage);
  const hint = said ? word(body?.hint) : '';
  const reference = word(body?.reference);
  return said ? `${said}${hint ? ` ${hint}` : ''}${reference ? ` Reference: ${reference}.` : ''}` : GATEWAY_MESSAGE;
}

/** The ng-zorro key of the 502/503 notice: a repeat replaces the one showing. */
export const GATEWAY_TOAST_KEY = 'http-gateway';

/** The sign-in pages (the bare /auth redirects to the sign-in form). */
const ON_SIGN_IN_PAGES = /^\/auth(\/|\?|#|$)/;

@Injectable({ providedIn: 'root' })
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private readonly notification: NzNotificationService,
    private readonly router: Router,
    private readonly injector: Injector,
    private readonly core: CoreService,
    private readonly tokens: TokenService,
    private appStore: Store<appState>
  ) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return this.send(req, next, false);
  }

  /** `retried`: this is the second send of a call a 401 refused, after the session was recovered. */
  private send(
    req: HttpRequest<any>,
    next: HttpHandler,
    retried: boolean
  ): Observable<HttpEvent<any>> {
    // The token this call goes out with, so a refusal can tell whether a refresh has replaced it since.
    const sentToken = this.tokens.gettoken();
    // Two requests never toast. Signing out clears the session whether or not the
    // server hears about it, so a failed logout must not put an error toast on the
    // sign-in page. And the sign-in form owns every sign-in failure: it says what
    // went wrong beside the form (login.component.ts), so a toast would be a
    // second, louder, message.
    // A refresh that fails says nothing of its own either: the call that needed it shows its usual message.
    const quiet = /\/auth\/(logout|login|refreshtoken)(\?|$)/.test(req.url) || req.context.get(FAILURES_SHOWN_BY_CALLER);
    const toast = (type: string, data: any, key?: string): void => {
      if (!quiet) this.createNotification(type, data, key);
    };
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        this.appStore.dispatch(unsetloadingAction());
        if (error.status === 429) {
          // The API rate-limits sign-in, forgot-password and a few other routes.
          // This used to show nothing, so the action looked dead.
          toast('error', 'Too many attempts. Wait a minute and try again.');
        }
        if (error.status === 400 && !req.context.get(FIELD_ERRORS_INLINE)) {
          toast('error', error.error.errormessage);
        }
        if (error.status === 403 && !req.context.get(FIELD_ERRORS_INLINE) && !req.context.get(FORBIDDEN_HANDLED)) {
          // The API refuses what the person's role does not allow with a 403. Most
          // screens do not say anything about it, so the action looked dead. A
          // screen that says it itself opts out (the two tokens above), so a
          // refusal is one message, never two.
          toast('error', "You don't have permission to do that.");
        }
        if (error.status === 404 && !req.context.get(FIELD_ERRORS_INLINE) && !req.context.get(NOT_FOUND_HANDLED)) {
          // The API answers 404 for a row that does not exist or is not the
          // caller's (a school, a learner, a class, a fee), and for a school name
          // that matches nothing. Most screens said nothing about it, so the
          // action looked dead. A screen that says it itself opts out (the two
          // tokens above), so a missing record is one message, never two.
          const said = error?.error?.errormessage;
          // Keyed, so a screen that asks for the same missing record several times at
          // once (learner stats sends four) shows one notice, not four: ng-zorro
          // replaces a notice that has the same key.
          toast('error', typeof said === 'string' && said.trim() ? said : NOT_FOUND_MESSAGE, NOT_FOUND_TOAST_KEY);
        }
        if (
          error.status === 401 &&
          req.url.startsWith(this.core.CORE_API()) &&
          !SESSION_FREE_URL.test(req.url) &&
          !ON_SIGN_IN_PAGES.test(this.router.url)
        ) {
          // Both APIs answer a role failure with 403 (edtech-lms-api#54, edtech-lms-rpi-api#35, 18 Sep
          // 2026), so a 401 means the token itself is no longer good: it expired, or a later sign-in
          // evicted it (one token per user). Get the session back with the refresh token, once however
          // many calls were refused together, and send this call again; if that cannot be done the
          // session is ended (cleared, sign-in page, one notice). Not on a sign-in page (the emailed-link
          // pages answer 401 for a bad link), and only the API's own answers count, not another host's.
          // The notice is shown even for a call that opted out of toasts: the person is being moved.
          // AuthService needs HttpClient, which needs the interceptors, so it is asked for only now.
          const auth = this.injector.get(AuthService);
          if (retried) {
            // Refused again with the new token: nothing more to try.
            auth.endSession();
            return throwError(error);
          }
          return from(auth.recoverOrEndSession(sentToken, req.context.get(ISSUES_TOKENS) ?? undefined)).pipe(
            switchMap((recovered) => (recovered ? this.send(req, next, true) : throwError(error)))
          );
        }
        if (error.status === 500) {
          toast(
            'error',
            error.error.errormessage +
              (error?.error?.logid
                ? `<BR>For further reference use ${error.error.logid}`
                : '')
          );
        }
        if ((error.status === 502 || error.status === 503) && !req.context.get(GATEWAY_HANDLED)) {
          // The API answers 502 when the student server refused it (edtech-lms-api#150) and 503 when something it
          // needs is down. It says what happened and what to try, with a reference; shown as it is, so the person
          // is not left with a button that did nothing. Keyed, so calls that fail together show one notice.
          toast('error', gatewayText(error), GATEWAY_TOAST_KEY);
        }
        if (error.status === 530) {
          this.router.navigate(['/auth/blocked']);
        }
        if (error.status === 0) {
          toast('error', 'Something went wrong..!!');
        }
        return throwError(error);
      }),
      map((x) => {
        this.appStore.dispatch(unsetloadingAction());
        return x;
      })
    );
  }
  createNotification(type: string, data: any, key?: string): void {
    this.notification.create(type, 'Error', data, key ? { nzKey: key } : undefined);
  }
}
