import { HttpClient, HttpContext, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { FIELD_ERRORS_INLINE } from 'src/app/interceptors/error-context';
import { IPaging } from 'src/app/models/IPaging';
import { updateBody } from 'src/app/models/media-library';
import type { DocumentMetadataModel } from 'src/app/models/media-library';
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

  /**
   * The upload's refusal (FILE_REJECTED, INVALID_INPUT) is shown by the caller beside the form, so the error
   * interceptor does not also toast it.
   */
  upload(formdata: FormData) {
    const req = new HttpRequest('POST', `${this.coreService.CORE_API()}document/upload`, formdata, {
      context: new HttpContext().set(FIELD_ERRORS_INLINE, true),
    });
    return this.http.request(req);
  }

  /** Title, licence and attribution of a document the caller owns. Never the file, its key or its type. */
  updatemetadata(documentid: string, meta: DocumentMetadataModel) {
    return this.http.put(`${this.coreService.CORE_API()}document/${documentid}`, updateBody(meta), {
      ...this.coreService.jsonhttpOptions,
      context: new HttpContext().set(FIELD_ERRORS_INLINE, true),
    });
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
