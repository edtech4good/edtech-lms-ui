import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './../services/auth.service';
@Injectable({ providedIn: 'root' })
export class AuthGuard  {
  constructor(
    private readonly router: Router,
    private authService: AuthService,
  ) { }
  async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    // let url: string = state.url;
    // login check
    if (this.authService.isLoggedIn) {
      const currentUser = this.authService.getLmsUser() ? this.authService.getLmsUser() : this.authService.getuser();
      const roles = route.data.roles;
      if (currentUser) {
        // roles auth guard
        if (currentUser.lmsuserrole) {
          if (roles) {
            const auth = this.authService.checkRole(roles);
            if (!auth) {
              this.router.navigate(['/unauthorised']);
            }
            return auth;
          }
        } else {
          return false;
        }
        return true;
      }
    }

    this.authService.logout();
    //this.router.navigate(['/auth/login']);
    return false;
  }

}
