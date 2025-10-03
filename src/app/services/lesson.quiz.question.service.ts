import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root'
})
export class LessonQuizQuestionService {

  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService,
  ) { }
  getquizquestion(lessonquizid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}lesson/quiz/question/${lessonquizid}`,
      this.coreService.jsonhttpOptions
    );
  }


  reorderquizquestion(lessonquizquestionid: string, lessonquizquestionorder: number) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/quiz/question/order/${lessonquizquestionid}/${lessonquizquestionorder}`,
      this.coreService.jsonhttpOptions
    );
  }

  activatequizquestion(lessonquizquestionid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/quiz/question/activate/${lessonquizquestionid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deactivatequizquestion(lessonquizquestionid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/quiz/question/deactivate/${lessonquizquestionid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deletequizquestion(lessonquizquestionid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}lesson/quiz/question/${lessonquizquestionid}`,
      this.coreService.jsonhttpOptions
    );
  }

  addquizquestion(lessonid: string, questionid: string, order: number) {
    return this.http.post(
      `${this.coreService.CORE_API()}lesson/quiz/question/${lessonid}/${questionid}/${order}`,
      this.coreService.jsonhttpOptions
    );
  }

}
