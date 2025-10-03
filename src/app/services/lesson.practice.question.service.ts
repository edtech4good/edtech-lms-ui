import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root'
})
export class LessonPracticeQuestionService {

  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService,
  ) { }
  getpracticequestion(lessonpracticeid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}lesson/practice/question/${lessonpracticeid}`,
      this.coreService.jsonhttpOptions
    );
  }


  reorderpracticequestion(lessonpracticequestionid: string, lessonpracticequestionorder: number) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/practice/question/order/${lessonpracticequestionid}/${lessonpracticequestionorder}`,
      this.coreService.jsonhttpOptions
    );
  }

  activatepracticequestion(lessonpracticequestionid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/practice/question/activate/${lessonpracticequestionid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deactivatepracticequestion(lessonpracticequestionid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/practice/question/deactivate/${lessonpracticequestionid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deletepracticequestion(lessonpracticequestionid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}lesson/practice/question/${lessonpracticequestionid}`,
      this.coreService.jsonhttpOptions
    );
  }

  addpracticequestion(lessonid: string, questionid: string, order: number) {
    return this.http.post(
      `${this.coreService.CORE_API()}lesson/practice/question/${lessonid}/${questionid}/${order}`,
      this.coreService.jsonhttpOptions
    );
  }

}
