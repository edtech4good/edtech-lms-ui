import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { unsetloadingAction } from '../store/appstate/appstate.action';
import { appState } from '../store/appstate/appstate.reducer';

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
    // Signing out clears the session whether or not the server hears about it, so
    // a failed logout request must not put an error toast on the sign-in page.
    const quiet = /\/auth\/logout(\?|$)/.test(req.url);
    // The sign-in form shows a failed sign-in (400) and a rate limit (429) in an
    // alert beside the form: that is the one message, so no toast for those two.
    // (A 500, or no connection, still gets its toast: the form has no words for it.)
    const formOwnsMessage = /\/auth\/login(\?|$)/.test(req.url);
    const toast = (type: string, data: any): void => {
      if (!quiet) this.createNotification(type, data);
    };
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        this.appStore.dispatch(unsetloadingAction());
        if (error.status === 429 && !formOwnsMessage) {
          // The API rate-limits sign-in, forgot-password and a few other routes.
          // This used to show nothing, so the action looked dead.
          toast('error', 'Too many attempts. Wait a minute and try again.');
        }
        if (error.status === 400 && !formOwnsMessage) {
          toast('error', error.error.errormessage);
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
