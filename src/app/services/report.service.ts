import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { IMultiPaging } from '../models/IPaging';
import { ResponseBody } from '../models/response.model';
import { ChartItemFormat, LineChartFormat } from '../modules/dashboard/index/models/LineChartFormat';

@Injectable({
  providedIn: 'root',
})
export class ReportService {
  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService
  ) {}
  getDashboard(countryid: string = '', year: number = new Date().getFullYear()) {
    return this.http.get<ResponseBody<Array<LineChartFormat>>>(
      `${this.coreService.CORE_API()}report/dashboard?countryid=${countryid}&year=${year}`,
      this.coreService.jsonhttpOptions
    );
  }

  getStudentsGender(countryid: string = '', schoolname: string = '') {
    return this.http.get<ResponseBody<Array<ChartItemFormat>>>(
      `${this.coreService.CORE_API()}report/gender?countryid=${countryid}&schoolname=${schoolname}`,
      this.coreService.jsonhttpOptions
    );
  }

  /**
   * Washington Group disaggregation. Three buckets: with disability, no
   * disability, and not collected — the last is learners nobody asked, which the
   * API deliberately keeps separate from "no disability".
   */
  getStudentsDisability(countryid: string = '', schoolname: string = '') {
    return this.http.get<ResponseBody<Array<ChartItemFormat>>>(
      `${this.coreService.CORE_API()}report/disability?countryid=${countryid}&schoolname=${schoolname}`,
      this.coreService.jsonhttpOptions
    );
  }

  getStudentsOfflineOnline(schoolname: string = '', countryid: string = '') {
    return this.http.get<ResponseBody<Array<ChartItemFormat>>>(
      `${this.coreService.CORE_API()}report/offlineonline?schoolname=${schoolname}&countryid=${countryid}`,
      this.coreService.jsonhttpOptions
    );
  }

  getStudentsProgressData(paging: IMultiPaging, online: boolean = false) {
    const endpoint = online ? 'report/online/studentprogress' : 'report/studentprogress';
    return this.http.post(
      `${this.coreService.CORE_API()}${endpoint}`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  getClassProgressData(paging: IMultiPaging, online: boolean = false) {
    const endpoint = online ? 'report/online/studentprogress/class' : 'report/studentprogress/class';
    return this.http.post(
      `${this.coreService.CORE_API()}${endpoint}`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  getLevelQuiz(paging: IMultiPaging, online: boolean = false) {
    const endpoint = online ? 'report/studentlevelquiz/online' : 'report/studentlevelquiz';
    return this.http.post(
      `${this.coreService.CORE_API()}${endpoint}`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  getClassLevelQuiz(paging: IMultiPaging, online: boolean = false) {
    const endpoint = online ? 'report/online/studentlevelquiz/class' : 'report/studentlevelquiz/class';
    return this.http.post(
      `${this.coreService.CORE_API()}${endpoint}`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  getStudentsLastProgress(paging: IMultiPaging, online: boolean = false) {
    const endpoint = online ? 'report/online/studentlastcompletedquiz' : 'report/studentlastcompletedquiz';
    return this.http.post(
      `${this.coreService.CORE_API()}${endpoint}`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  getStudentsActivity(paging: IMultiPaging, online: boolean = false) {
    const endpoint = online ? 'report/online/studentstatus' : 'report/studentstatus';
    return this.http.post(
      `${this.coreService.CORE_API()}${endpoint}`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  getSyncRecords(paging: IMultiPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}report/syncrecords`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  getDashboardData(schoolname: string) {
    return this.http.get<ResponseBody<Array<ChartItemFormat>>>(
      `${this.coreService.CORE_API()}report/dashboard/school/${schoolname}`,
      this.coreService.jsonhttpOptions
    );
  }

  getGenderDataByCountry(countryid: string) {
    return this.http.get<ResponseBody<Array<ChartItemFormat>>>(
      `${this.coreService.CORE_API()}report/gender/country/${countryid}`,
      this.coreService.jsonhttpOptions
    );
  }

  getGenderDataBySchool(schoolname: string) {
    return this.http.get<ResponseBody<Array<ChartItemFormat>>>(
      `${this.coreService.CORE_API()}report/gender/school/${schoolname}`,
      this.coreService.jsonhttpOptions
    );
  }

  getStudentUsages() {
    return this.http.get<ResponseBody<Array<LineChartFormat>>>(
      `${this.coreService.CORE_API()}report/studentusage`,
      this.coreService.jsonhttpOptions
    );
  }

  getStudentsGradeProgress(paging: IMultiPaging, online: boolean = false) {
    const endpoint = online ? 'report/online/student-grade-progress' : 'report/student-grade-progress';
    return this.http.post(
      `${this.coreService.CORE_API()}${endpoint}`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  getStudentsLevelProgress(paging: IMultiPaging, online: boolean = false) {
    const endpoint = online ? 'report/online/student-level-progress' : 'report/student-level-progress';
    return this.http.post(
      `${this.coreService.CORE_API()}${endpoint}`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  getStudentsLessonProgress(paging: IMultiPaging, online: boolean = false) {
    const endpoint = online ? 'report/online/student-lesson-progress' : 'report/student-lesson-progress';
    return this.http.post(
      `${this.coreService.CORE_API()}${endpoint}`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  downloadQuizzes(paging: IMultiPaging, online: boolean = false) {
    const endpoint = online ? 'report/online/studentprogress/download' : 'report/studentprogress/download';
    return this.http.post(
      `${this.coreService.CORE_API()}${endpoint}`,
      paging,
      {
        responseType: 'blob'
      }
    );
  }
  downloadQuizzesOfClass(paging: IMultiPaging, online: boolean = false) {
    const endpoint = online ? 'report/online/studentprogress/class/download' : 'report/studentprogress/class/download';
    return this.http.post(
      `${this.coreService.CORE_API()}${endpoint}`,
      paging,
      {
        responseType: 'blob'
      }
    );
  }

  downloadCurrentQuizzes(paging: IMultiPaging, online: boolean = false) {
    const endpoint = online ? 'report/online/studentlastcompletedquiz/download' : 'report/studentlastcompletedquiz/download';
    return this.http.post(
      `${this.coreService.CORE_API()}${endpoint}`,
      paging,
      {
        responseType: 'blob'
      }
    );
  }

  downloadLevelQuizzes(paging: IMultiPaging, online: boolean = false) {
    const endpoint = online ? 'report/online/studentlevelquiz/download' : 'report/studentlevelquiz/download';
    return this.http.post(
      `${this.coreService.CORE_API()}${endpoint}`,
      paging,
      {
        responseType: 'blob'
      }
    );
  }
  downloadClassLevelQuizzes(paging: IMultiPaging, online: boolean = false) {
    const endpoint = online ? 'report/online/studentlevelquiz/class/download' : 'report/studentlevelquiz/class/download';
    return this.http.post(
      `${this.coreService.CORE_API()}${endpoint}`,
      paging,
      {
        responseType: 'blob'
      }
    );
  }

  downloadStudentStatus(paging: IMultiPaging, online: boolean = false) {
    const endpoint = online ? 'report/online/studentstatus/download' : 'report/studentstatus/download';
    return this.http.post(
      `${this.coreService.CORE_API()}${endpoint}`,
      paging,
      {
        responseType: 'blob'
      }
    );
  }

  getTechDowntime(body?: {startDate: Date, endDate: Date}) {
    return this.http.post<ResponseBody<Array<LineChartFormat>>>(
      `${this.coreService.CORE_API()}report/techdowntime`,
      body,
      this.coreService.jsonhttpOptions
    );
  }
}
