import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService
  ) {}
  getall(paging: IPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}user`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  delete(userid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}user/${userid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(lmsuser: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}user/${lmsuser.lmsuserid}`,
      {
        lmsusername: lmsuser.lmsusername,
        lmsuserpasswordhash: lmsuser.lmsuserpasswordhash,
        lmsuserroles: lmsuser.lmsuserroles,
        countryids: lmsuser.countryids,
        schoolids: lmsuser.schoolids,
      },
      this.coreService.jsonhttpOptions
    );
  }
  create(
    lmsusername: string,
    lmsuserpasswordhash: string,
    lmsuserroles: [],
    countryids: [],
    schoolids: []
  ) {
    return this.http.post(
      `${this.coreService.CORE_API()}user/create`,
      {
        lmsusername,
        lmsuserpasswordhash,
        lmsuserroles,
        countryids,
        schoolids,
      },
      this.coreService.jsonhttpOptions
    );
  }
  get(lmsuserid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}user/${lmsuserid}`,
      this.coreService.jsonhttpOptions
    );
  }
}
