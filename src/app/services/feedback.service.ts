import { HttpClient, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CoreService } from './core.service';
import { IMultiPaging, IPaging } from '../models/IPaging';

@Injectable({
  providedIn: 'root'
})
export class FeedbackService {

  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService
  ) {}
  getall(paging: IMultiPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}feedback`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  getData(){
    return this.http.get(
      `${this.coreService.CORE_API()}feedback`,
      this.coreService.jsonhttpOptions
    )
  }

  delete(feedbackid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}feedback/${feedbackid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(feedback: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}feedback/${feedback.feedbackid}`,
      {
        feedback: feedback.feedback,
      },
      this.coreService.jsonhttpOptions
    );
  }
  create(feedback: FormData) {
    const req = new HttpRequest('POST', `${this.coreService.CORE_API()}feedback/create`, feedback, {});
    return this.http.request(req);
    // return this.http.post(
    //   `${this.coreService.CORE_API()}feedback/create`,
    //   {
    //     feedback,
    //   },
    //   this.coreService.jsonhttpOptions
    // );
  }
  get(feedbackid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}feedback/${feedbackid}`,
      this.coreService.jsonhttpOptions
    );
  }
}
