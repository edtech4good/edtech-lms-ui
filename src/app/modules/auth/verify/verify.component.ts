import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-verify',
  templateUrl: './verify.component.html',
  styleUrls: ['./verify.component.less']
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
    const result: any = await this.authService.verify(token).pipe(first()).toPromise()
    if (!result.data) {
      this.notification.create("error", 'Error', "Invalid link!!");
      this.router.navigate(['auth/login']);
      return;
    } else {
      this.notification.create("success", 'Success', "Email verified, please login");
      this.router.navigate(['auth/login']);
    }
  }
}
