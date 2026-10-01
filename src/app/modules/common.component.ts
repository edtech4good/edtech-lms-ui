import { Component, OnInit } from '@angular/core';
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
    standalone: false
})
export class CommonComponent implements OnInit {
  user: lmsuser | null = null;

  constructor(
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
  /**
   * Sign out. AuthService.logout() does all of it: it starts the server-side
   * logout (the bearer token is read synchronously when the request is
   * subscribed, so clearing storage on the next line cannot race it), clears the
   * user store and the stored tokens, and then goes to /auth/login.
   */
  logout(): void {
    this.authService.logout();
  }

  /**
   * The skip link cannot be a plain `#main-content` href: with <base href="/"> that
   * would navigate to the app root. Move focus to the main region instead.
   */
  skipToContent(event: Event): void {
    event.preventDefault();
    document.getElementById('main-content')?.focus();
  }
}
