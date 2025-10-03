import { HttpClient, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {

  constructor(
    private http: HttpClient,
    private readonly coreService: CoreService,
  ) { }
  getall(paging: IPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}document`, paging,
      this.coreService.jsonhttpOptions
    );
  }

  gets3URL(key: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}document/url/${key}`,
      this.coreService.jsonhttpOptions
    );
  }

  delete(documentid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}document/${documentid}`,
      this.coreService.jsonhttpOptions
    );
  }

  upload(formdata: FormData) {
    const req = new HttpRequest('POST', `${this.coreService.CORE_API()}document/upload`, formdata, {});
    return this.http.request(req);
  }

  addtag(documentid: string, tag: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}document/tag/${documentid}/${tag}`,
      this.coreService.jsonhttpOptions
    );
  }

  removeTag(documentid: string, tag: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}document/tag/${documentid}/${tag}`,
      this.coreService.jsonhttpOptions
    );
  }

}
