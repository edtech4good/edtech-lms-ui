import { HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { isPublicAuthPath } from './public-auth-paths';

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
   * True when the page being shown is one a signed-out user is meant to see (see
   * public-auth-paths.ts). Used by AuthService.routetoLogin so those pages are not
   * bounced to the sign-in form.
   */
  ignoreToken = () => isPublicAuthPath(window.location.pathname);

  constructor() {}
}
