import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { FAILURES_SHOWN_BY_CALLER, FIELD_ERRORS_INLINE } from 'src/app/interceptors/error-context';
import { CoreService } from 'src/app/services/core.service';
import { AddLearnerBody, CreatedLearner } from '../modules/student/add-learner/add-learner-form';
import { DisabledResult } from '../modules/student/account-disable';
import { EditLearnerBody, EditLearnerResult, LearnerDetails } from '../modules/student/edit-learner/edit-learner';
import { ResetPasswordBody, ResetResult } from '../modules/student/reset-password/reset-password';
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
  /** Whether a learner username is free. The caller says every failure itself (a failed check never blocks a save). */
  usernameAvailable(username: string) {
    return this.http.get<{ available: boolean }>(`${this.coreService.CORE_API()}student/username-available`, {
      ...this.coreService.jsonhttpOptions,
      params: new HttpParams().set('username', username),
      context: new HttpContext().set(FAILURES_SHOWN_BY_CALLER, true),
    });
  }
  /** One learner, made as the acting organisation. A 400 names its fields; the caller shows them beside the form. */
  createOne(body: AddLearnerBody) {
    return this.http.post<CreatedLearner>(`${this.coreService.CORE_API()}student/one`, body, {
      ...this.coreService.jsonhttpOptions,
      context: new HttpContext().set(FIELD_ERRORS_INLINE, true),
    });
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
  /** Stops or allows a learner's sign-in. The learner's progress is kept. */
  setDisabled(schooluserid: string, disabled: boolean) {
    return this.http.put<DisabledResult>(
      `${this.coreService.CORE_API()}student/${schooluserid}/disabled`,
      { disabled },
      this.coreService.jsonhttpOptions
    );
  }
  /** Sets a new password for one learner. A 400 names its field; the drawer shows it beside the form. */
  resetPassword(schooluserid: string, body: ResetPasswordBody) {
    return this.http.put<ResetResult>(`${this.coreService.CORE_API()}student/${schooluserid}/password`, body, {
      ...this.coreService.jsonhttpOptions,
      context: new HttpContext().set(FIELD_ERRORS_INLINE, true),
    });
  }
  /** One learner's editable details. The caller says every failure itself. */
  getDetails(schooluserid: string) {
    return this.http.get<LearnerDetails>(`${this.coreService.CORE_API()}student/${schooluserid}/details`, {
      ...this.coreService.jsonhttpOptions,
      context: new HttpContext().set(FAILURES_SHOWN_BY_CALLER, true),
    });
  }
  /** Saves one learner's details. A 400 names its fields; the drawer shows them beside the form. */
  updateDetails(schooluserid: string, body: EditLearnerBody) {
    return this.http.put<EditLearnerResult>(`${this.coreService.CORE_API()}student/${schooluserid}/details`, body, {
      ...this.coreService.jsonhttpOptions,
      context: new HttpContext().set(FIELD_ERRORS_INLINE, true),
    });
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
