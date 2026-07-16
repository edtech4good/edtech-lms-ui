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
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        this.appStore.dispatch(unsetloadingAction());
        if (error.status === 400) {
          this.createNotification('error', error.error.errormessage);
        }
        if (error.status === 401) {
          if (this.route.snapshot.url.length > 0) {
            this.router.navigateByUrl('/auth/login');
          }
        }
        if (error.status === 500) {
          this.createNotification(
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
          this.createNotification('error', 'Something went wrong..!!');
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
