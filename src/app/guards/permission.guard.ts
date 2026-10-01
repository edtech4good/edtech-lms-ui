import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NgxPermissionsService } from 'ngx-permissions';
import { AuthService } from '../services/auth.service';

/**
 * A route that needs one named permission. Without it the user is sent to the
 * existing not-authorised page.
 *
 * The shell loads the permissions into ngx-permissions when it first renders, and
 * route guards run before that on a cold load (a reload, a typed URL), so this
 * loads them from the token itself when nothing is loaded yet.
 */
export function requirePermission(permission: string): CanActivateFn {
  return () => {
    const permissions = inject(NgxPermissionsService);
    const auth = inject(AuthService);
    const router = inject(Router);
    if (Object.keys(permissions.getPermissions()).length === 0) {
      const user = auth.getLmsUser() ?? auth.getuser();
      permissions.loadPermissions(user.permissions ?? []);
    }
    return permissions.getPermission(permission) ? true : router.createUrlTree(['/un-authorized']);
  };
}
