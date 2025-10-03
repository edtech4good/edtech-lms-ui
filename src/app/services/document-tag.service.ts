import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root'
})
export class DocumentTagService {

  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService,
  ) { }
  getall(paging: IPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}documenttag`, paging,
      this.coreService.jsonhttpOptions
    );
  }

  delete(documenttagid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}documenttag/${documenttagid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(documenttag: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}documenttag/${documenttag.documenttagid}`, {
      documenttagname: documenttag.documenttagname
    },
      this.coreService.jsonhttpOptions
    );
  }
  create(documenttagname: string) {
    return this.http.post(
      `${this.coreService.CORE_API()}documenttag/create`, {
      documenttagname
    },
      this.coreService.jsonhttpOptions
    );
  }
  get(documenttagid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}documenttag/${documenttagid}`,
      this.coreService.jsonhttpOptions
    );
  }

}
