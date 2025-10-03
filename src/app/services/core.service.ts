import { HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { indexOf } from 'voca';

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

  ignoreToken = () => {
    let tokenignorelist = [
      '/auth/login',
      '/auth/changepassword',
      '/auth/verify',
    ];
    return !tokenignorelist.find((x) => indexOf(window.location.pathname, x));
  };

  constructor() {}
}
