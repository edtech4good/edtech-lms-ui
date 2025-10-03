import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root'
})
export class LessonLearningService {

  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService,
  ) { }

  getlearnings(lessonid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}lesson/learning/${lessonid}`,
      this.coreService.jsonhttpOptions
    );
  }

  getlearning(lessonid: string, lessonlearningid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}lesson/learning/${lessonid}/${lessonlearningid}`,
      this.coreService.jsonhttpOptions
    );
  }

  reorderlearning(lessonlearningid: string, lessonlearningorder: number) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/learning/order/${lessonlearningid}/${lessonlearningorder}`,
      this.coreService.jsonhttpOptions
    );
  }

  activatelearning(lessonlearningid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/learning/activate/${lessonlearningid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deactivatelearning(lessonlearningid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/learning/deactivate/${lessonlearningid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deletelearning(lessonlearningid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}lesson/learning/${lessonlearningid}`,
      this.coreService.jsonhttpOptions
    );
  }

  addlearning(lessonid: string, lessonlearning: {
    "documentid": string;
    "lessonlearningorder": number;
    "lessonlearningname": string;
    "lessonlearningdescription": string
  }) {
    return this.http.post(
      `${this.coreService.CORE_API()}lesson/learning/${lessonid}`,
      {
        ...lessonlearning
      },
      this.coreService.jsonhttpOptions
    );
  }


  updatelearning(lessonlearningid: string, lessonlearning: {
    "documentid": string;
    "lessonlearningname": string;
    "lessonlearningdescription": string;
    "lessonid": string;
  }) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/learning/${lessonlearningid}`,
      {
        "lessonid": lessonlearning.lessonid,
        "documentid": lessonlearning.documentid,
        "lessonlearningname": lessonlearning.lessonlearningname,
        "lessonlearningdescription": lessonlearning.lessonlearningdescription
      },
      this.coreService.jsonhttpOptions
    );
  }

}
