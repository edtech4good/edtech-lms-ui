import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NgxPermissionsService } from 'ngx-permissions';
import { first } from 'rxjs/operators';
import { LoginRequestBody } from 'src/app/models/loginrequestbody';
import { AuthService } from 'src/app/services/auth.service';
import { UtilService } from 'src/app/services/util.service';
import { uploadStudentsValidationSchema } from 'src/app/services/validator.service';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    standalone: false
})
export class LoginComponent implements OnInit {
  changePasswordisVisible = false;
  loginForm!: UntypedFormGroup;
  changePasswordForm!: UntypedFormGroup;
  isloading = false;
  /** The Show/Hide toggle on the password field. */
  showPassword = false;
  /** Why the last attempt failed, shown beside the form (the form is the only place). */
  loginError: string | null = null;

  @ViewChild('emailInput') private emailInput?: ElementRef<HTMLInputElement>;
  @ViewChild('passwordInput') private passwordInput?: ElementRef<HTMLInputElement>;
  @ViewChild('submitButton') private submitButton?: ElementRef<HTMLButtonElement>;

  /** A required field the user has touched or submitted past, and left empty. */
  showInvalid(name: 'lmsusername' | 'lmsuserpassword'): boolean {
    const control = this.loginForm.get(name);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  async submitLoginForm() {
    this.loginError = null;
    this.utilservice.checkFormDirty(this.loginForm);
    if (!this.loginForm.valid) {
      // Put the keyboard on the first field that needs attention.
      const first = this.loginForm.get('lmsusername')?.invalid ? this.emailInput : this.passwordInput;
      first?.nativeElement.focus();
    }
    if (this.loginForm.valid) {
      this.isloading = true;
      const tempCred = <LoginRequestBody>{
        lmsusername: this.loginForm.getRawValue()['lmsusername'],
        lmsuserpassword: this.loginForm.getRawValue()['lmsuserpassword'],
      };
      // let authresponse =
      this.authService.login(tempCred)
        .subscribe((authresponse: any)=>{
          if(authresponse){
            this.authService.setlogin(
              authresponse.data.accessToken,
              authresponse.data.refreshToken
            );
            var perms = this.permissionsService.getPermission('view_plus_reach');
            if(perms) {
              this.router.navigate(['dashboard/index']);
            } else {
              this.router.navigate(['dashboard/default']);
            }
          }
        },
        (error: HttpErrorResponse)=>{
          if(error){
            this.isloading = false;
            this.loginError = this.loginErrorMessage(error);
            this.returnFocus(error);
          }
        },
        ()=>{
          this.isloading = false;
        });
    }
  }

  /**
   * The message to show beside the form. The form owns every sign-in failure
   * (the error interceptor never toasts for /auth/login). Always the same words
   * for a failed sign-in: the API's text says "username", and staff sign in with
   * an email.
   */
  private loginErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 400) {
      return 'The email or password is incorrect.';
    }
    if (error.status === 429) {
      return 'Too many sign-in attempts. Wait a minute and try again.';
    }
    if (error.status === 0) {
      return "Can't reach the server. Check your connection and try again.";
    }
    return "Sign-in isn't available right now. Try again in a moment.";
  }

  /**
   * The Sign in button was disabled while the request ran, which dropped focus to
   * the page. After a wrong password the next thing to do is retype it; after any
   * other failure the next thing is to press Sign in again.
   */
  private returnFocus(error: HttpErrorResponse): void {
    // The button is enabled again only once the view has updated.
    this.cdr.detectChanges();
    const target = error.status === 400 ? this.passwordInput : this.submitButton;
    target?.nativeElement.focus();
  }

  constructor(
    private fb: UntypedFormBuilder,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
    private authService: AuthService,
    private permissionsService: NgxPermissionsService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    //Check behaiour of logout and enable
    //this.authService.logout();
    this.loginForm = this.fb.group({
      lmsusername: [null, [Validators.required]],
      lmsuserpassword: [null, [Validators.required]],
    });
  }

  hideChangePassword = () => {
    this.changePasswordisVisible = false;
  };

  showChangePassword = () => {
    this.changePasswordForm = this.fb.group({
      lmsusername: [null, [Validators.required]],
    });
    this.changePasswordisVisible = true;
  };

  submitchangePasswordForm = async () => {
    this.utilservice.checkFormDirty(this.changePasswordForm);
    await this.authService
      .forgotpassword(this.changePasswordForm.getRawValue().lmsusername)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Sucess',
      'Update pasword link sent to your emailid'
    );
    this.hideChangePassword();
  };
}
