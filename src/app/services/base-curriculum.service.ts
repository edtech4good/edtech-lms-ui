import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root',
})
export class BaseCurriculumService {
  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService
  ) {}
  getall() {
    return this.http.get(
      `${this.coreService.CORE_API()}curriculumbaseline/all`
    );
  }

  getallQuery(baselinename: string, baselinetype: number) {
    return this.http.get(
      `${this.coreService.CORE_API()}curriculumbaseline/query?baselinename=${baselinename}&baselinetype=${baselinetype}`
    );
  }

  getcurriculumbaselineid(curriculumbaselineid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}curriculumbaseline/getcurriculumbaseline/${curriculumbaselineid}`,
      this.coreService.jsonhttpOptions
    )
  }

  getschoolcurriculumbaseline(curriculumbaselineid: string){
    return this.http.get(
      `${this.coreService.CORE_API()}curriculumbaseline/school/${curriculumbaselineid}`,
      this.coreService.jsonhttpOptions
    )
  }

  delete(curriculumbaselineid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}curriculumbaseline/${curriculumbaselineid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(curriculum: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}curriculum/${curriculum.curriculumid}`,
      {
        curriculumname: curriculum.curriculumname,
        curriculumdescription: curriculum.curriculumdescription,
      },
      this.coreService.jsonhttpOptions
    );
  }

  updateBaseline(curriculumbasline: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}curriculumbaseline/update/${curriculumbasline.curriculumbaselineid}`,
      {
        curriculumid: curriculumbasline.curriculumid,
        baselineid: curriculumbasline.curriculumid,
        baselinename: curriculumbasline.baselinename,
        baselinetype: curriculumbasline.baselinetype,
        startdate: curriculumbasline.startdate,
        enddate: curriculumbasline.enddate,
        schoolid: curriculumbasline.schoolid,
      },
    );
  }

  activate(curriculumbaselineid: string, curriculumid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}curriculumbaseline/activate/${curriculumbaselineid}/${curriculumid}`,
      this.coreService.jsonhttpOptions
    )
  }

  deactivate(curriculumbaselineid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}curriculumbaseline/deactivate/${curriculumbaselineid}`,
      this.coreService.jsonhttpOptions
    )
  }

  create(
    curriculumid: string,
    baselinename: string,
    baselinetype: number,
    startdate: Date,
    enddate: Date,
    schoolid: JSON,
  ) {
    return this.http.post(
      `${this.coreService.CORE_API()}curriculumbaseline/create`,
      {
        curriculumid: curriculumid,
        baselineid: curriculumid,
        baselinename: baselinename,
        baselinetype: baselinetype,
        startdate: startdate,
        enddate: enddate,
        schoolid: schoolid,
        // curriculumbaselineid: '',
      },
      this.coreService.jsonhttpOptions
    );
  }
  get(curriculumbaselineid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}curriculumbaseline/getcurriculumbaseline/${curriculumbaselineid}`,
      this.coreService.jsonhttpOptions
    );
  }

  cloudsync() {
    return this.http.post(
      `${this.coreService.CORE_API()}sync/cloud`,
      this.coreService.jsonhttpOptions
    );
  }

  downloadStudentBaselineResult(curriculumbaselineid: string){
    return this.http.get(
      `${this.coreService.CORE_API()}curriculumbaseline/${curriculumbaselineid}/download`,
      {
        responseType: 'blob'
      }
    )
  }
}
