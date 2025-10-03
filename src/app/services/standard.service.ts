import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';
import { IMultiPaging } from '../models/IPaging';

@Injectable({
  providedIn: 'root',
})
export class StandardService {
  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService
  ) {}
  getall(paging: IMultiPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}standard`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  delete(standardid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}standard/${standardid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(standard: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}standard/${standard.standardid}`,
      {
        standardname: standard.standardname,
        schoolid: standard.schoolid,
      },
      this.coreService.jsonhttpOptions
    );
  }
  create(standardname: string, schoolid: string) {
    return this.http.post(
      `${this.coreService.CORE_API()}standard/create`,
      {
        standardname,
        schoolid,
      },
      this.coreService.jsonhttpOptions
    );
  }
  get(standardid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}standard/${standardid}`,
      this.coreService.jsonhttpOptions
    );
  }

  getSchoolidStandard(schoolid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}standard/school/${schoolid}`,
      this.coreService.jsonhttpOptions
    )
  }

  getAllStandards(standardname: string = '', schoolname: string = '') {
    return this.http.get(
      `${this.coreService.CORE_API()}standard/all?standardname=${standardname}&schoolname=${schoolname}`,
      this.coreService.jsonhttpOptions
    );
  }
}
