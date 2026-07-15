import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { NgxPermissionsService } from 'ngx-permissions';
import { NgxSpinnerService } from 'ngx-spinner';
import { lmsuser } from '../models/lmsuser.model';
import { AuthService } from '../services/auth.service';
import { appState } from '../store/appstate/appstate.reducer';
import { getappLoading } from '../store/appstate/appstate.selector';

@Component({
  selector: 'app-common',
  templateUrl: './common.component.html',
  styleUrls: ['./common.component.less'],
})
export class CommonComponent implements OnInit {
  isCollapsed = false;
  user: lmsuser | null = null;

  /**
   * ngx-permissions treats arrays as OR. The LMS JWT includes the synthetic permission
   * `superadmin` for superadmin@superadmin.com (see central API). Only User / Role menu
   * entries listed `superadmin` explicitly, so the rest of the sidebar stayed hidden when
   * the token did not yet carry every `view_*` name (e.g. report/dashboard-only keys).
   */
  sidebarPerm(...keys: string[]): string[] {
    return [...keys, 'superadmin'];
  }

  constructor(
    private readonly router: Router,
    private spinner: NgxSpinnerService,
    private store: Store<appState>,
    private authService: AuthService,
    private permissionsService: NgxPermissionsService
  ) {
    const user = this.authService.getLmsUser();
    this.user = user ? user : this.authService.getuser();
    const perms = this.permissionsService.getPermissions();
    if(!perms || Object.keys(perms).length === 0) this.permissionsService.loadPermissions(this.user.permissions ?? []);
  }

  ngOnInit(): void {
    this.store.select(getappLoading).subscribe((apploading) => {
      if (apploading) {
        this.spinner.show();
      } else {
        this.spinner.hide();
      }
    });
  }
  logout(): void {
    this.router.navigateByUrl('/auth/login');
  }
}
