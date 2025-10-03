import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root'
})
export class LevelQuizQuestionService {

  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService,
  ) { }

  getquizquestion(levelid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}level/quiz/question/${levelid}`,
      this.coreService.jsonhttpOptions
    );
  }

  getbindlesson(levelquestionid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}level/quiz/question/lesson/${levelquestionid}`,
      this.coreService.jsonhttpOptions
    );
  }

  reorderquizquestion(levelquizquestionid: string, levelquizquestionorder: number) {
    return this.http.put(
      `${this.coreService.CORE_API()}level/quiz/question/order/${levelquizquestionid}/${levelquizquestionorder}`,
      this.coreService.jsonhttpOptions
    );
  }

  activatequizquestion(levelquizquestionid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}level/quiz/question/activate/${levelquizquestionid}`,
      this.coreService.jsonhttpOptions
    );
  }

  setlesson(levelquizquestionid: string, lessonid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}level/quiz/question/setlesson/${levelquizquestionid}`,
      {
        lessonid
      },
      this.coreService.jsonhttpOptions
    );
  }

  deactivatequizquestion(levelquizquestionid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}level/quiz/question/deactivate/${levelquizquestionid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deletequizquestion(levelquizquestionid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}level/quiz/question/${levelquizquestionid}`,
      this.coreService.jsonhttpOptions
    );
  }

  addquizquestion(levelid: string, questionid: string, order: number) {
    return this.http.post(
      `${this.coreService.CORE_API()}level/quiz/question/${levelid}/${questionid}/${order}`,
      this.coreService.jsonhttpOptions
    );
  }

}
