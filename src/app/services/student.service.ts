import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';
import { StudentEditedImportBody, StudentImportBody } from '../models/studentimport';

@Injectable({
  providedIn: 'root',
})
export class StudentService {
  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService
  ) {}
  getall(paging: IPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}student`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }
  uploadStudent(data: StudentImportBody) {
    return this.http.post(
      `${this.coreService.CORE_API()}student/create?online=false`,
      data,
      this.coreService.jsonhttpOptions
    );
  }
  uploadEditedStudent(data: StudentEditedImportBody) {
    return this.http.put(
      `${this.coreService.CORE_API()}student/update`,
      data,
      this.coreService.jsonhttpOptions
    );
  }
  exportStudent(schoolname: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}export/${schoolname}/students`,
      {
        responseType: 'blob',
      }
    );
  }
  synccloudStudent(schoolname: string) {
    return this.http.post(
      `${this.coreService.CORE_API()}sync/cloud/${schoolname}/students`,
      this.coreService.jsonhttpOptions
    );
  }
  deleteStudent(schooluserid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}student/${schooluserid}`,
      this.coreService.jsonhttpOptions
    );
  }

  getStudent(studentid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}student/${studentid}`,
      this.coreService.jsonhttpOptions
    );
  }

  getStudentStats(studentid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}student/stats/${studentid}`,
      this.coreService.jsonhttpOptions
    );
  }

  getStudentPracticeStats(studentid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}student/stats/${studentid}/practice`,
      this.coreService.jsonhttpOptions
    );
  }

  getStudentQuizStats(studentid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}student/stats/${studentid}/quiz`,
      this.coreService.jsonhttpOptions
    );
  }
  getStudentLevelStats(studentid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}student/stats/${studentid}/level`,
      this.coreService.jsonhttpOptions
    );
  }

  getAllUsers(userid: string = '', schoolname: string = '', standardid: string = '', search_teacher: string = 'false') {
    return this.http.get(
      `${this.coreService.CORE_API()}student/all?userid=${userid}&schoolname=${schoolname}&standard=${standardid}&teacher=${search_teacher}`,
      this.coreService.jsonhttpOptions
    );
  }

  downloadStudent(countryid: any, schoolname: any, studentid: any) {
    return this.http.get(
      `${this.coreService.CORE_API()}student/download-students?countryid=${countryid}&schoolname=${schoolname}&studentid=${studentid}`,
      {
        responseType: 'blob'
      }
    );
  }

  exportStudents(schoolname: any) {
    return this.http.get(
      `${this.coreService.CORE_API()}export/${schoolname}/students`,
      {
        responseType: 'blob'
      }
    );
  }
}
