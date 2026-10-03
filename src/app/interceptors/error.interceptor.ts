import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { unsetloadingAction } from '../store/appstate/appstate.action';
import { appState } from '../store/appstate/appstate.reducer';
import { FIELD_ERRORS_INLINE, FORBIDDEN_HANDLED, NOT_FOUND_HANDLED } from './error-context';

/** What a 404 says when the API gave no words of its own. */
export const NOT_FOUND_MESSAGE = 'That record was not found. It may have been removed, or it may not be yours to see.';

@Injectable({ providedIn: 'root' })
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private readonly notification: NzNotificationService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
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
    const quiet = /\/auth\/(logout|login)(\?|$)/.test(req.url);
    const toast = (type: string, data: any): void => {
      if (!quiet) this.createNotification(type, data);
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
          toast('error', typeof said === 'string' && said.trim() ? said : NOT_FOUND_MESSAGE);
        }
        if (error.status === 401) {
          // The API returns 401 for role failures too (access.guard.ts), not just
          // a bad/expired token, so this must not clear the session here until the
          // API returns 403 for role failures instead (tracked separately).
          if (this.route.snapshot.url.length > 0) {
            this.router.navigateByUrl('/auth/login');
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
  createNotification(type: string, data: any): void {
    this.notification.create(type, 'Error', data);
  }
}
