import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root',
})
export class CurriculumService {
  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService
  ) {}
  getall(paging: IPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}curriculum`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  delete(curriculumid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}curriculum/${curriculumid}`,
      this.coreService.jsonhttpOptions
    );
  }

  activate(curriculumid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}curriculum/activate/${curriculumid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deactivate(curriculumid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}curriculum/deactivate/${curriculumid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(curriculum: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}curriculum/${curriculum.curriculumid}`,
      {
        curriculumname: curriculum.curriculumname,
        curriculumdescription: curriculum.curriculumdescription,
        countryid: curriculum.countryid,
        subjectid: curriculum.subjectid,
      },
      this.coreService.jsonhttpOptions
    );
  }
  create(curriculumname: string, curriculumdescription: string, countryid: [string], subjectid: string) {
    return this.http.post(
      `${this.coreService.CORE_API()}curriculum/create`,
      {
        curriculumname,
        curriculumdescription,
        countryid,
        subjectid
      },
      this.coreService.jsonhttpOptions
    );
  }
  get(curriculumid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}curriculum/${curriculumid}`,
      this.coreService.jsonhttpOptions
    );
  }
  getByCountryid(countryid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}curriculum/country/${countryid}`,
      this.coreService.jsonhttpOptions
    );
  }
  map() {
    return this.http.get(
      `${this.coreService.CORE_API()}curriculum/map`,
      this.coreService.jsonhttpOptions
    );
  }
  tree() {
    return this.http.get(
      `${this.coreService.CORE_API()}curriculum/tree`,
      this.coreService.jsonhttpOptions
    );
  }

  curriculumtree(curriculumid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}curriculum/tree/${curriculumid}`,
      this.coreService.jsonhttpOptions
    );
  }

  cloudsync() {
    return this.http.post(
      `${this.coreService.CORE_API()}sync/cloud`,
      this.coreService.jsonhttpOptions
    );
  }

  getAllCurriculums(curid: string = '', studentid: string = '', standardid: string = '', schoolname: string = '') {
    return this.http.get(
      `${this.coreService.CORE_API()}curriculum/all?curid=${curid}&studentid=${studentid}&standardid=${standardid}&schoolname=${schoolname}`,
      this.coreService.jsonhttpOptions
    );
  }
}
