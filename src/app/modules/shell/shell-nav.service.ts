import { Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { NgxPermissionsService } from 'ngx-permissions';
import {
  HOME_FALLBACK_ROUTE,
  HOME_ROUTE,
  ShellActive,
  pathOf,
  resolveActive,
} from './shell-nav.config';

/**
 * Where the user is in the menu. Shared by the nav (which item is active, which
 * sub-list is open) and the breadcrumb (is this page Home).
 */
@Injectable({ providedIn: 'root' })
export class ShellNavService {
  /** Where Home leads for this user. */
  homeRoute: string;

  /** The active menu item for the current URL; null when no item matches. */
  readonly active = signal<ShellActive | null>(null);

  constructor(
    private readonly router: Router,
    private readonly permissions: NgxPermissionsService,
  ) {
    this.homeRoute = this.computeHomeRoute();
    this.update(this.router.url);
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.update(event.urlAfterRedirects);
      }
    });
  }

  /** The item that would be active for `url` (does not touch state). */
  resolve(url: string): ShellActive | null {
    return resolveActive(url, this.computeHomeRoute());
  }

  private update(url: string): void {
    this.homeRoute = this.computeHomeRoute();
    this.active.set(resolveActive(pathOf(url), this.homeRoute));
  }

  private computeHomeRoute(): string {
    // Same rule the login page uses to choose where to land.
    const perms = this.permissions.getPermissions();
    return perms['view_plus_reach'] || perms['superadmin'] ? HOME_ROUTE : HOME_FALLBACK_ROUTE;
  }
}
