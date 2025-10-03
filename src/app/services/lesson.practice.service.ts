import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root'
})
export class LessonPracticeService {

  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService,
  ) { }


  getpractices(lessonid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}lesson/practice/${lessonid}`,
      this.coreService.jsonhttpOptions
    );
  }

  getpractice(lessonid: string, lessonpracticeid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}lesson/practice/${lessonid}/${lessonpracticeid}`,
      this.coreService.jsonhttpOptions
    );
  }

  reorderpractice(lessonpracticeid: string, lessonpracticeorder: number) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/practice/order/${lessonpracticeid}/${lessonpracticeorder}`,
      this.coreService.jsonhttpOptions
    );
  }

  activatepractice(lessonpracticeid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/practice/activate/${lessonpracticeid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deactivatepractice(lessonpracticeid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/practice/deactivate/${lessonpracticeid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deletepractice(lessonpracticeid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}lesson/practice/${lessonpracticeid}`,
      this.coreService.jsonhttpOptions
    );
  }

  addpractice(lessonid: string, lessonpractice: {
    "lessonpracticeorder": number;
    "lessonpracticename": string;
    "lessonpracticedescription": string
    "points": number;
  }) {
    return this.http.post(
      `${this.coreService.CORE_API()}lesson/practice/${lessonid}`,
      {
        ...lessonpractice
      },
      this.coreService.jsonhttpOptions
    );
  }


  updatepractice(lessonpracticeid: string, lessonpractice: {
    "lessonpracticename": string;
    "lessonpracticedescription": string;
    "lessonid": string;
    "points": number;
  }) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/practice/${lessonpracticeid}`,
      {
        "lessonid": lessonpractice.lessonid,
        "lessonpracticename": lessonpractice.lessonpracticename,
        "lessonpracticedescription": lessonpractice.lessonpracticedescription,
        "points": lessonpractice.points
      },
      this.coreService.jsonhttpOptions
    );
  }

}
