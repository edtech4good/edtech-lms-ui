import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root'
})
export class LessonQuizService {

  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService,
  ) { }


  getquizs(lessonid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}lesson/quiz/${lessonid}`,
      this.coreService.jsonhttpOptions
    );
  }

  getquiz(lessonid: string, lessonquizid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}lesson/quiz/${lessonid}/${lessonquizid}`,
      this.coreService.jsonhttpOptions
    );
  }

  reorderquiz(lessonquizid: string, lessonquizorder: number) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/quiz/order/${lessonquizid}/${lessonquizorder}`,
      this.coreService.jsonhttpOptions
    );
  }

  activatequiz(lessonquizid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/quiz/activate/${lessonquizid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deactivatequiz(lessonquizid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/quiz/deactivate/${lessonquizid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deletequiz(lessonquizid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}lesson/quiz/${lessonquizid}`,
      this.coreService.jsonhttpOptions
    );
  }

  addquiz(lessonid: string, lessonquiz: {
    "lessonquizorder": number;
    "lessonquizname": string;
    "lessonquizdescription": string;
    "points": number;
  }) {
    return this.http.post(
      `${this.coreService.CORE_API()}lesson/quiz/${lessonid}`,
      {
        ...lessonquiz
      },
      this.coreService.jsonhttpOptions
    );
  }


  updatequiz(lessonquizid: string, lessonquiz: {
    "lessonquizname": string;
    "lessonquizdescription": string;
    "lessonid": string;
    "points": number;
  }) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/quiz/${lessonquizid}`,
      {
        "lessonid": lessonquiz.lessonid,
        "lessonquizname": lessonquiz.lessonquizname,
        "lessonquizdescription": lessonquiz.lessonquizdescription,
        "points": lessonquiz.points
      },
      this.coreService.jsonhttpOptions
    );
  }

}
