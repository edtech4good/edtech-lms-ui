import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root'
})
export class QuestionTagService {

  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService,
  ) { }
  getall(paging: IPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}questiontag`, paging,
      this.coreService.jsonhttpOptions
    );
  }

  delete(questiontagid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}questiontag/${questiontagid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(questiontag: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}questiontag/${questiontag.questiontagid}`, {
      questiontagname: questiontag.questiontagname
    },
      this.coreService.jsonhttpOptions
    );
  }
  create(questiontagname: string) {
    return this.http.post(
      `${this.coreService.CORE_API()}questiontag/create`, {
      questiontagname
    },
      this.coreService.jsonhttpOptions
    );
  }
  get(questiontagid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}questiontag/${questiontagid}`,
      this.coreService.jsonhttpOptions
    );
  }

}
