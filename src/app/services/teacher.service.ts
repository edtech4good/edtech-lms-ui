import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { FIELD_ERRORS_INLINE } from 'src/app/interceptors/error-context';
import { CoreService } from 'src/app/services/core.service';
import { TeacherImportBody } from '../models/teacherimport';
import { AddTeacherBody, CreatedTeacher } from '../modules/teacher/add-teacher/add-teacher-form';
import { DisabledResult } from '../modules/student/account-disable';
import { ResetPasswordBody, ResetResult } from '../modules/student/reset-password/reset-password';

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
  /** One teacher, made as the acting organisation. A 400 names its fields; the caller shows them beside the form. */
  createOne(body: AddTeacherBody) {
    return this.http.post<CreatedTeacher>(`${this.coreService.CORE_API()}teacher/one`, body, {
      ...this.coreService.jsonhttpOptions,
      context: new HttpContext().set(FIELD_ERRORS_INLINE, true),
    });
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
  /** Stops or allows a teacher's sign-in. */
  setDisabled(schooluserid: string, disabled: boolean) {
    return this.http.put<DisabledResult>(
      `${this.coreService.CORE_API()}teacher/${schooluserid}/disabled`,
      { disabled },
      this.coreService.jsonhttpOptions
    );
  }
  /** Sets a new password for one teacher. A 400 names its field; the drawer shows it beside the form. */
  resetPassword(schooluserid: string, body: ResetPasswordBody) {
    return this.http.put<ResetResult>(`${this.coreService.CORE_API()}teacher/${schooluserid}/password`, body, {
      ...this.coreService.jsonhttpOptions,
      context: new HttpContext().set(FIELD_ERRORS_INLINE, true),
    });
  }
  deleteTeacher(schooluserid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}teacher/${schooluserid}`,
      this.coreService.jsonhttpOptions
    );
  }
}
