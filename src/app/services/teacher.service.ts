import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';
import { TeacherImportBody } from '../models/teacherimport';

@Injectable({
  providedIn: 'root',
})
export class TeacherService {
  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService
  ) {}
  getall(paging: IPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}teacher`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }
  uploadTeacher(data: TeacherImportBody) {
    return this.http.post(
      `${this.coreService.CORE_API()}teacher/create`,
      data,
      this.coreService.jsonhttpOptions
    );
  }
  exportTeacher(schoolname: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}export/${schoolname}/teachers`,
      {
        responseType: 'blob',
      }
    );
  }
  synccloudTeacher(schoolname: string) {
    return this.http.post(
      `${this.coreService.CORE_API()}sync/cloud/${schoolname}/teachers`,
      this.coreService.jsonhttpOptions
    );
  }
  deleteTeacher(schooluserid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}teacher/${schooluserid}`,
      this.coreService.jsonhttpOptions
    );
  }
}
