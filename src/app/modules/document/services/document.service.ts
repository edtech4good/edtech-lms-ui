import { HttpClient, HttpContext, HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { filter, lastValueFrom } from 'rxjs';
import { FIELD_ERRORS_INLINE } from 'src/app/interceptors/error-context';
import { IPaging } from 'src/app/models/IPaging';
import { refusalMessage, updateBody, uploadFieldsForFile } from 'src/app/models/media-library';
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

  /**
   * Upload files one request at a time, in order: `POST /document/upload` takes exactly one file per request (more is
   * refused by the server's multer limit before the handler runs). Each file carries the batch's licence and attribution
   * and its own title. A refused file does not stop the others; each result says what the server answered for that file.
   */
  async uploadEach(entries: Array<{ file: File; title: string }>, meta: DocumentMetadataModel): Promise<Array<{ file: File; title: string; error?: string }>> {
    const results: Array<{ file: File; title: string; error?: string }> = [];
    for (const entry of entries) {
      const formData = new FormData();
      // the optional details first, then the file
      Object.entries(uploadFieldsForFile(meta, entry.title)).forEach(([key, value]) => formData.append(key, value));
      formData.append('files[]', entry.file);
      try {
        await lastValueFrom(this.upload(formData).pipe(filter((e) => e instanceof HttpResponse)));
        results.push({ ...entry });
      } catch (error) {
        results.push({ ...entry, error: refusalMessage(error as HttpErrorResponse) });
      }
    }
    return results;
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
