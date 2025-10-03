import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from "./../../environments/environment"
const PAYLOAD_KEY = environment.PAYLOAD_KEY;
const ALG_KEY = environment.ALG_KEY;
const HASH_KEY = environment.HASH_KEY;
const REFRESH_PAYLOAD_KEY = environment.REFRESH_PAYLOAD_KEY;
const REFRESH_ALG_KEY = environment.REFRESH_ALG_KEY;
const REFRESH_HASH_KEY = environment.REFRESH_HASH_KEY;

const accesstokenkeys = ['PAYLOAD_KEY', 'ALG_KEY', 'HASH_KEY'];
const refreshtokenkeys = [
  'REFRESH_PAYLOAD_KEY',
  'REFRESH_ALG_KEY',
  'REFRESH_HASH_KEY',
];
const storagekeys = [...accesstokenkeys, ...refreshtokenkeys];

@Injectable({
  providedIn: 'root',
})
export class TokenService {
  constructor(private router: Router) { }
  subscriptions: Array<any> = [];


  clearaccesstokens = (): void => {
    accesstokenkeys.forEach((element) => {
      window.sessionStorage.removeItem(element);
    });
  };

  clearrefreshtokens = (): void => {
    refreshtokenkeys.forEach((element) => {
      window.sessionStorage.removeItem(element);
    });
  };

  cleartokens = (): void => {
    storagekeys.forEach((element) => {
      window.sessionStorage.removeItem(element);
    });
  };

  savetoken = (accesstoken: string): void => {
    this.clearaccesstokens();
    const tokens = accesstoken.split('.');
    window.sessionStorage.setItem(ALG_KEY, tokens[0]);
    window.sessionStorage.setItem(PAYLOAD_KEY, tokens[1]);
    window.sessionStorage.setItem(HASH_KEY, tokens[2]);
  };

  saverefreshtoken = (refreshtoken: string): void => {
    this.clearrefreshtokens();
    const tokens = refreshtoken.split('.');
    window.sessionStorage.setItem(REFRESH_ALG_KEY, tokens[0]);
    window.sessionStorage.setItem(REFRESH_PAYLOAD_KEY, tokens[1]);
    window.sessionStorage.setItem(REFRESH_HASH_KEY, tokens[2]);
  };

  gettoken = (): string => {
    const alg = sessionStorage.getItem(ALG_KEY);
    const payload = sessionStorage.getItem(PAYLOAD_KEY);
    const hash = sessionStorage.getItem(HASH_KEY);
    if (alg && payload && hash) {
      return `${alg}.${payload}.${hash}`;
    }
    return '';
  };

  logout() {
    sessionStorage.clear();
    this.clearaccesstokens();
    this.clearrefreshtokens();
    this.cleartokens();
    // window.location.reload();
    // this.router.navigateByUrl('/auth/login');
  }

  getrefreshtoken = (): string =>
    `${sessionStorage.getItem(REFRESH_ALG_KEY)}.${sessionStorage.getItem(
      REFRESH_PAYLOAD_KEY
    )}.${sessionStorage.getItem(REFRESH_HASH_KEY)}`;

  getuser = (): any => JSON.parse(sessionStorage.getItem(PAYLOAD_KEY) || "{}");
}
