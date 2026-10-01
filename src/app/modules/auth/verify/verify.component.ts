import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { AuthService } from 'src/app/services/auth.service';
import { INVALID_LINK_MESSAGE } from '../auth-messages';

@Component({
    selector: 'app-verify',
    templateUrl: './verify.component.html',
    styleUrls: ['./verify.component.less'],
    standalone: false
})
export class VerifyComponent implements OnInit {

  constructor(
    private router: Router, private readonly notification: NzNotificationService,
    private authService: AuthService,
    private route: ActivatedRoute) { }

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.paramMap.get("token") ?? "";
    if ((token || '').trim().length <= 0) {
      this.router.navigate(['auth/login']);
      return;
    }
    let result: any;
    try {
      result = await this.authService.verify(token).pipe(first()).toPromise();
    } catch (error) {
      // This page has nothing to show, so a failed check always ends at sign-in.
      // A 401 is the API saying the link is no good (the interceptor already
      // toasts 400 and 500, and a dropped connection).
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.notification.create('error', 'Error', INVALID_LINK_MESSAGE);
      }
      this.router.navigate(['auth/login']);
      return;
    }
    if (!result.data) {
      this.notification.create('error', 'Error', INVALID_LINK_MESSAGE);
      this.router.navigate(['auth/login']);
      return;
    } else {
      this.notification.create("success", 'Success', 'Email verified. Sign in to continue.');
      this.router.navigate(['auth/login']);
    }
  }
}
