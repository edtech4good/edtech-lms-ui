import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { CoreService } from '../services/core.service';
import { unsetloadingAction } from '../store/appstate/appstate.action';
import { appState } from '../store/appstate/appstate.reducer';
import {
  FAILURES_SHOWN_BY_CALLER,
  FIELD_ERRORS_INLINE,
  FORBIDDEN_HANDLED,
  NOT_FOUND_HANDLED,
  SESSION_RECOVERED_BY_CALLER,
} from './error-context';

/** What a 404 says when the API gave no words of its own. */
export const NOT_FOUND_MESSAGE = 'That record was not found. It may have been removed, or it may not be yours to see.';

/** The ng-zorro key of the 404 notice: a repeat replaces the one showing. */
export const NOT_FOUND_TOAST_KEY = 'http-404';

/** What a 401 says when it ends the session. */
export const SESSION_ENDED_MESSAGE = 'Your session has ended. Sign in again.';

/** The ng-zorro key of the session-ended notice: calls that fail together show one notice. */
export const SESSION_ENDED_TOAST_KEY = 'http-401';

/**
 * A 401 on these is not an ended session. The sign-in call answers it for the form (a wrong
 * password), a logout and a refresh are made with a token that is already dead, and the callers
 * of the refresh handle its failure themselves.
 */
const SESSION_FREE_URL = /\/auth\/(login|logout|refreshtoken)(\?|$)/;

/** The sign-in pages (the bare /auth redirects to the sign-in form). */
const ON_SIGN_IN_PAGES = /^\/auth(\/|\?|#|$)/;

@Injectable({ providedIn: 'root' })
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private readonly notification: NzNotificationService,
    private readonly router: Router,
    private readonly injector: Injector,
    private readonly core: CoreService,
    private appStore: Store<appState>
  ) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Two requests never toast. Signing out clears the session whether or not the
    // server hears about it, so a failed logout must not put an error toast on the
    // sign-in page. And the sign-in form owns every sign-in failure: it says what
    // went wrong beside the form (login.component.ts), so a toast would be a
    // second, louder, message.
    const quiet = /\/auth\/(logout|login)(\?|$)/.test(req.url) || req.context.get(FAILURES_SHOWN_BY_CALLER);
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
          !req.context.get(SESSION_RECOVERED_BY_CALLER)
        ) {
          // Both APIs answer a role failure with 403 (edtech-lms-api#54, edtech-lms-rpi-api#35, 18 Sep
          // 2026), so a 401 means the token itself is no longer good: it expired, or a later sign-in
          // evicted it (one token per user). Clear the session and go to the sign-in page, once. Not
          // while already on a sign-in page (the emailed-link pages answer 401 for a bad link, and the
          // sign-in page has nothing to clear). Only the API's own answers count, not another host's.
          if (!ON_SIGN_IN_PAGES.test(this.router.url)) {
            // AuthService needs HttpClient, which needs the interceptors, so it is asked for only now.
            this.injector.get(AuthService).clearSession();
            // The sign-in page has no return target, so this goes to it plainly.
            this.router.navigateByUrl('/auth/login');
            // Keyed, so calls that fail together show one notice, not several.
            this.notification.info(SESSION_ENDED_MESSAGE, '', { nzKey: SESSION_ENDED_TOAST_KEY });
          }
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
