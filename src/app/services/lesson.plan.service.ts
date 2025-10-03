import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root'
})
export class LessonPlanService {

  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService,
  ) { }

  getplans(lessonid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}lesson/plan/${lessonid}`,
      this.coreService.jsonhttpOptions
    );
  }

  getplan(lessonid: string, lessonplanid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}lesson/plan/${lessonid}/${lessonplanid}`,
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

  deleteplan(lessonplanid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}lesson/plan/${lessonplanid}`,
      this.coreService.jsonhttpOptions
    );
  }

  addplan(lessonid: string, lessonplan: {
    "documentid": string;
    "lessonplanorder": number;
    "lessonplanname": string;
    "lessonplandescription": string
  }) {
    return this.http.post(
      `${this.coreService.CORE_API()}lesson/plan/${lessonid}`,
      {
        ...lessonplan
      },
      this.coreService.jsonhttpOptions
    );
  }


  updateplan(lessonplanid: string, lessonplan: {
    "documentid": string;
    "lessonplanname": string;
    "lessonplandescription": string;
    "lessonid": string;
  }) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/plan/${lessonplanid}`,
      {
        "lessonid": lessonplan.lessonid,
        "documentid": lessonplan.documentid,
        "lessonplanname": lessonplan.lessonplanname,
        "lessonplandescription": lessonplan.lessonplandescription
      },
      this.coreService.jsonhttpOptions
    );
  }

}
