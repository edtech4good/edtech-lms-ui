import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { NzTreeNode, NzTreeNodeOptions } from 'ng-zorro-antd/tree';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';
import { ResponseBody } from '../models/response.model';
import { IMultiPaging } from '../models/IPaging';

@Injectable({
  providedIn: 'root',
})
export class RolePermService {
  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService
  ) {}
  getall(paging: IMultiPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}roles`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }
  getallRoles() {
    return this.http.get(
      `${this.coreService.CORE_API()}roles`,
      this.coreService.jsonhttpOptions
    );
  }
  getpermNodes() {
    return this.http.get<ResponseBody<NzTreeNodeOptions[] | NzTreeNode[]>>(
      `${this.coreService.CORE_API()}roles/node/permissions`,
      this.coreService.jsonhttpOptions
    );
  }

  delete(roleid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}roles/${roleid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(role: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}roles/${role.roleid}`,
      {
        rolename: role.rolename,
        permissionsid: role.permissions,
      },
      this.coreService.jsonhttpOptions
    );
  }
  create(rolename: string, permissions: []) {
    return this.http.post(
      `${this.coreService.CORE_API()}roles/create`,
      {
        rolename,
        permissionsid: permissions
      },
      this.coreService.jsonhttpOptions
    );
  }
  get(countryid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}roles/${countryid}`,
      this.coreService.jsonhttpOptions
    );
  }
}
