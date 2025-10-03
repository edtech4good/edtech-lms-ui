import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CoreService } from './core.service';
import { ResponseBody } from '../models/response.model';
import { LineChartFormat } from '../modules/dashboard/index/models/LineChartFormat';
import { IPaging } from '../models/IPaging';

@Injectable({
  providedIn: 'root'
})
export class SchoolContributeService {
  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService
  ) {}

  create(schoolname: string, schoolid: string,countryid: string, expected: number, actual: number) {
    return this.http.post(
      `${this.coreService.CORE_API()}school-contribute/create`,{
        schoolname,
        schoolid,
        countryid,
        expected,
        actual
      },
      this.coreService.jsonhttpOptions
    );
  }

  updateSchoolName(schoolcontribute: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}school-contribute/updateschoolname/${schoolcontribute.schoolid}`,{
        schoolname: schoolcontribute.schoolname,
        countryid: schoolcontribute.countryid,
      },
      this.coreService.jsonhttpOptions
    );
  }

  updateSchoolDashboard(schoolcontribute: any){
    return this.http.put(
      `${this.coreService.CORE_API()}school-contribute/updateschooldashboard/${schoolcontribute.schoolcontributeid}`,{
        expected: schoolcontribute.expected,
        actual: schoolcontribute.actual,
      },
      this.coreService.jsonhttpOptions
    );
  }

  deleteSchoolContribute(schoolid: string){
    return this.http.delete(
      `${this.coreService.CORE_API()}school-contribute/deleteschoolcontribute/${schoolid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deleteSchoolContributeDashboard(schoolcontributeid: string){
    return this.http.delete(
      `${this.coreService.CORE_API()}school-contribute/deleteschoolcontributeid/${schoolcontributeid}`,
      this.coreService.jsonhttpOptions
    );
  }

  getSchoolContributedashboard() {
    return this.http.get<ResponseBody<Array<LineChartFormat>>>(
      `${this.coreService.CORE_API()}school-contribute/getAllSchoolDashboard`,
      this.coreService.jsonhttpOptions
    )
  }

  getSchoolContributedashboardId(schoolid: string) {
    return this.http.get<ResponseBody<Array<LineChartFormat>>>(
      `${this.coreService.CORE_API()}school-contribute/getschooldashboardid/${schoolid}`,
      this.coreService.jsonhttpOptions
    )
  }

  getSchoolContributeById(schoolid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}school-contribute/getschoolcontribute/${schoolid}`,
      this.coreService.jsonhttpOptions
    )
  }

  getSchoolContributeId(schoolcontributeid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}school-contribute/getschooldashboard/schoolcontributeid/${schoolcontributeid}`,
      this.coreService.jsonhttpOptions
    )
  }

  getall(paging: IPaging,schoolid: string,) {
    return this.http.post(
      `${this.coreService.CORE_API()}school-contribute/getallschoolcontribute/${schoolid}`,paging,
      this.coreService.jsonhttpOptions
    );
  }

  getAllSchoolContribute(countryid: string,schoolname: string, date: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}school-contribute/all?countryid=${countryid}&schoolname=${schoolname}&date=${date}&`,
      this.coreService.jsonhttpOptions
    );
  }

  getReportContribute(date: string) {
    return this.http.post(
      `${this.coreService.CORE_API()}school-contribute/report/download`,
      {
        date: date,
      },
      {
        responseType: 'blob',
      },
    );
  }

}
