import { HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CoreService {
  CORE_API = () => `${environment.SCHEMA}://${environment.API_URL}/`;
  COREDOMAIN = () => `${environment.API_URL}`;
  jsonhttpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
  };
  blobhttpOptions = {
    responseType: 'blob',
  };
  filehttpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'multipart/form-data' }),
  };
  csvfileOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/csv' }),
  };

  /**
   * True when the page being shown is one a signed-out user is meant to see: the
   * sign-in page and the emailed links (reset password, verify email). Used by
   * AuthService.routetoLogin so those pages are not bounced to the sign-in form.
   * Matches the path itself or anything beneath it, not other paths that merely
   * start with the same letters (/auth/loginx).
   */
  ignoreToken = () => {
    const tokenignorelist = [
      '/auth/login',
      '/auth/changepassword',
      '/auth/verify',
    ];
    const path = window.location.pathname;
    return tokenignorelist.some((x) => path === x || path.startsWith(x + '/'));
  };

  constructor() {}
}
