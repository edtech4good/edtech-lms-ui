import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { Question } from 'src/app/models/question.model';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root'
})
export class QuestionService {

  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService,
  ) { }
  getall(paging: IPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}question`, paging,
      this.coreService.jsonhttpOptions
    );
  }

  getallOR(paging: IPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}question/search`, paging,
      this.coreService.jsonhttpOptions
    );
  }

  delete(questionid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}question/${questionid}`,
      this.coreService.jsonhttpOptions
    );
  }

  activate(questionid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}question/activate/${questionid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deactivate(questionid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}question/deactivate/${questionid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(question: Question) {
    return this.http.put(
      `${this.coreService.CORE_API()}question/${question.questionid}`, {
      ...question
    },
      this.coreService.jsonhttpOptions
    );
  }
  updateIdentifier(questionid: string, questionidentifier: string) {
    return this.http.put(`${this.coreService.CORE_API()}question/${questionid}/questionidentifier/${questionidentifier}`, this.coreService.jsonhttpOptions);
  }
  create(question: Question) {
    return this.http.post(
      `${this.coreService.CORE_API()}question/create`, {
      ...question
    },
      this.coreService.jsonhttpOptions
    );
  }
  get(questionid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}question/${questionid}`,
      this.coreService.jsonhttpOptions
    );
  }
  addtag(questionid: string, tag: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}question/tag/${questionid}/${tag}`,
      this.coreService.jsonhttpOptions
    );
  }

  removeTag(questionid: string, tag: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}question/tag/${questionid}/${tag}`,
      this.coreService.jsonhttpOptions
    );
  }
}
