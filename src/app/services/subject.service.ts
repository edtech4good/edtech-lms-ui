import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IMultiPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root',
})
export class SubjectService {
  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService
  ) {}
  getall(paging: IMultiPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}subject`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  delete(subjectid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}subject/${subjectid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(subject: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}subject/${subject.subjectid}`,
      {
        subjectname: subject.subjectname,
        subjectdescription: subject.subjectdescription,
      },
      this.coreService.jsonhttpOptions
    );
  }
  create(subjectname: string, subjectdescription: string) {
    return this.http.post(
      `${this.coreService.CORE_API()}subject/create`,
      {
        subjectname,
        subjectdescription,
      },
      this.coreService.jsonhttpOptions
    );
  }
  get(subjectid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}subject/${subjectid}`,
      this.coreService.jsonhttpOptions
    );
  }
}
