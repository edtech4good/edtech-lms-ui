import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root',
})
export class BaselineQuestionService {
  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService
  ) {}

  getall(curriculumbaselineid: string){
    return this.http.get(
      `${this.coreService.CORE_API()}baselinequestion/getall/${curriculumbaselineid}`,
      this.coreService.jsonhttpOptions
    );
  }

  addquizquestion(curriculumbaselineid: string, questionid: string, order: number) {
    return this.http.post(
      `${this.coreService.CORE_API()}baselinequestion/create/`,
      {
        curriculumbaselineid: curriculumbaselineid,
        questionid: questionid,
        baselinequestionorder: order,
      },
      this.coreService.jsonhttpOptions
    );
  }

  clonequestion(curriculumbaselineid: string, clonecurriculumbaselineid:string){
    return this.http.post(
      `${this.coreService.CORE_API()}baselinequestion/clone`,
      {
        curriculumbaselineid:curriculumbaselineid,
        clonecurriculumbaselineid:clonecurriculumbaselineid,
      },
      this.coreService.jsonhttpOptions
    )
  }

  reorderbaselinequestion(baselinequestionid: string, baselinequestionorder: number) {
    return this.http.put(
      `${this.coreService.CORE_API()}baselinequestion/order/${baselinequestionid}/${baselinequestionorder}`,
      this.coreService.jsonhttpOptions
    )
  }

  activatebaseline(baselinequestionid: string){
    return this.http.put(
      `${this.coreService.CORE_API()}baselinequestion/activate/${baselinequestionid}`,
      this.coreService.jsonhttpOptions,
    )
  }

  deactivatebaseline(baselinequestionid: string){
    return this.http.put(
      `${this.coreService.CORE_API()}baselinequestion/deactivate/${baselinequestionid}`,
      this.coreService.jsonhttpOptions,
    )
  }

  delete(baselinequestionid: string){
    return this.http.delete(
      `${this.coreService.CORE_API()}baselinequestion/${baselinequestionid}`,
      this.coreService.jsonhttpOptions
    )
  }

}
