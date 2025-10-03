import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { ResetPasswordBody } from 'src/app/models/changepassword';
import { AuthService } from 'src/app/services/auth.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.less']
})
export class ChangePasswordComponent implements OnInit {

  changePasswordisVisible = false;
  changePassworForm!: FormGroup;
  changePasswordForm!: FormGroup;

  async submitLoginForm() {
    this.utilservice.checkFormDirty(this.changePassworForm);
    if (this.changePassworForm.valid) {
      const tempCred = {
        lmsuserpassword: this.changePassworForm.getRawValue()['lmsuserpassword'],
        lmsuserconfirmpassword: this.changePassworForm.getRawValue()['lmsuserconfirmpassword'],
      }
      if (tempCred.lmsuserconfirmpassword !== tempCred.lmsuserpassword) {
        this.notification.create("error", 'Error', "Passwords don't match");

      }
      const temp = <ResetPasswordBody>{
        lmsuserpassword: this.changePassworForm.getRawValue()['lmsuserpassword']
      };
      const token = this.route.snapshot.paramMap.get("token") ?? "";
      await this.authService.changepassword(temp, token).toPromise();
      this.notification.create("success", 'Sucess', "Password updated sucesfully");
      this.router.navigate(['dashboard/index']);
    }
  }

  constructor(private fb: FormBuilder,
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
      this.notification.create("error", 'Error', "Invalid link!!");
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
