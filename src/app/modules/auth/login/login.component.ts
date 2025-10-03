import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
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
  styleUrls: ['./login.component.less'],
})
export class LoginComponent implements OnInit {
  changePasswordisVisible = false;
  loginForm!: FormGroup;
  changePasswordForm!: FormGroup;
  isloading = false;

  async submitLoginForm() {
    this.isloading = true;
    this.utilservice.checkFormDirty(this.loginForm);
    if (this.loginForm.valid) {
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
        (error)=>{
          if(error){
            this.isloading = false;
          }
        },
        ()=>{
          this.isloading = false;
        });
    }
  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
    private authService: AuthService,
    private permissionsService: NgxPermissionsService,
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
