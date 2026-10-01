import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { ResetPasswordBody } from 'src/app/models/changepassword';
import { AuthService } from 'src/app/services/auth.service';
import { UtilService } from 'src/app/services/util.service';
import { INVALID_LINK_MESSAGE } from '../auth-messages';

@Component({
    selector: 'app-change-password',
    templateUrl: './change-password.component.html',
    standalone: false
})
export class ChangePasswordComponent implements OnInit {

  changePasswordisVisible = false;
  changePassworForm!: UntypedFormGroup;
  changePasswordForm!: UntypedFormGroup;

  /** The two passwords were different when the form was last submitted. */
  mismatch = false;

  @ViewChild('confirmInput') private confirmInput?: ElementRef<HTMLInputElement>;

  /** A required field the user has touched or submitted past, and left empty. */
  showInvalid(name: 'lmsuserpassword' | 'lmsuserconfirmpassword'): boolean {
    const control = this.changePassworForm.get(name);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  /** What is wrong with the Confirm field, if anything. */
  get confirmError(): string | null {
    if (this.showInvalid('lmsuserconfirmpassword')) return 'Enter the new password again.';
    if (this.mismatch) return "The passwords don't match.";
    return null;
  }

  async submitLoginForm() {
    this.mismatch = false;
    this.utilservice.checkFormDirty(this.changePassworForm);
    if (!this.changePassworForm.valid) return;
    const { lmsuserpassword, lmsuserconfirmpassword } = this.changePassworForm.getRawValue();
    if (lmsuserconfirmpassword !== lmsuserpassword) {
      // Say so beside the field, and send nothing.
      this.mismatch = true;
      this.confirmInput?.nativeElement.focus();
      return;
    }
    const temp = <ResetPasswordBody>{ lmsuserpassword };
    const token = this.route.snapshot.paramMap.get("token") ?? "";
    try {
      await this.authService.changepassword(temp, token).toPromise();
    } catch (error) {
      // A 401 means the link is no good (the interceptor already toasts 400 and
      // 500). Say so, and leave: there is nothing to retry on this page.
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.notification.create('error', 'Error', INVALID_LINK_MESSAGE);
        this.router.navigate(['auth/login']);
      }
      return;
    }
    // The user is signed out: the next step is to sign in with the new password.
    this.notification.create('success', 'Success', 'Password updated. Sign in with your new password.');
    this.router.navigate(['auth/login']);
  }

  constructor(private fb: UntypedFormBuilder,
    private router: Router, private readonly notification: NzNotificationService,
    private utilservice: UtilService, private authService: AuthService,
    private route: ActivatedRoute) { }

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.paramMap.get("token") ?? "";
    if ((token || '').trim().length <= 0) {
      this.router.navigate(['auth/login']);
      return;
    }
    const result: any = await this.authService.validatechangepassword(token).pipe(first()).toPromise()
    if (!result.data) {
      this.notification.create('error', 'Error', INVALID_LINK_MESSAGE);
      this.router.navigate(['auth/login']);
      return;
    }
    this.changePasswordisVisible = true;
    this.changePassworForm = this.fb.group({
      lmsuserconfirmpassword: [null, [Validators.required]],
      lmsuserpassword: [null, [Validators.required]],
    });
  }
}
