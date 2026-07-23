import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IMultiPaging, IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';
import { ResponseBody } from '../models/response.model';
import { LineChartFormat } from '../modules/dashboard/index/models/LineChartFormat';

@Injectable({
  providedIn: 'root',
})
export class SchoolService {
  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService
  ) {}
  getall(paging: IMultiPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}school`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  delete(schoolid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}school/${schoolid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(school: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}school/update/${school.schoolid}`,
      {
        schoolname: school.schoolname,
        countryid: school.countryid,
        curriculums: school.curriculums,
        uitheme: school.uitheme,
      },
      this.coreService.jsonhttpOptions
    );
  }
  create(schoolname: string, countryid: string, curriculums: Array<string>) {
    return this.http.post(
      `${this.coreService.CORE_API()}school/create`,
      {
        schoolname,
        countryid,
        curriculums
      },
      this.coreService.jsonhttpOptions
    );
  }
  get(schoolid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}school/${schoolid}`,
      this.coreService.jsonhttpOptions
    );
  }
  getCurriculums(schoolid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}school/${schoolid}/curriculums`,
      this.coreService.jsonhttpOptions
    );
  }
  getAllSchools(schoolname: string = '', countryid: string = '') {
    return this.http.get(
      `${this.coreService.CORE_API()}school/all?countryid=${countryid}&school=${schoolname}`,
      this.coreService.jsonhttpOptions
    );
  }

  getSchoolsCurriculum(curriculumid: string = '') {
    return this.http.get(
      `${this.coreService.CORE_API()}school/curriculumid?curriculumid=${curriculumid}`,
      this.coreService.jsonhttpOptions
    );
  }

  // school-contribute dashboard
  getSchoolByCountryId(countryid: string) {
    return this.http.get<ResponseBody<Array<LineChartFormat>>>(
      `${this.coreService.CORE_API()}school/dashboard/${countryid}`,
      this.coreService.jsonhttpOptions
    )
  }
}
