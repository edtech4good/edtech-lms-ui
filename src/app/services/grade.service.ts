import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root'
})
export class GradeService {

  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService,
  ) { }
  getall(paging: IPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}grade`, paging,
      this.coreService.jsonhttpOptions
    );
  }

  delete(gradeid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}grade/${gradeid}`,
      this.coreService.jsonhttpOptions
    );
  }

  activate(gradeid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}grade/activate/${gradeid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deactivate(gradeid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}grade/deactivate/${gradeid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(grade: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}grade/${grade.gradeid}`, {
      gradename: grade.gradename,
      gradedescription: grade.gradedescription,
      curriculumid: grade.curriculumid,
      gradeorder: grade.gradeorder,
      passing_points: grade.passing_points
    },
      this.coreService.jsonhttpOptions
    );
  }
  create(gradename: string, gradedescription: string, curriculumid: string, gradeorder: number, passing_points: number) {
    return this.http.post(
      `${this.coreService.CORE_API()}grade/create`, {
      gradename,
      gradedescription,
      curriculumid,
      gradeorder,
      passing_points
    },
      this.coreService.jsonhttpOptions
    );
  }
  get(gradeid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}grade/${gradeid}`,
      this.coreService.jsonhttpOptions
    );
  }

  getAllGrades(grade: string = '', curid: string = '', studentid: string = '', standardid: string = '', schoolname: string = '') {
    return this.http.get(
      `${this.coreService.CORE_API()}grade/all?grade=${grade}&curid=${curid}&studentid=${studentid}&standardid=${standardid}&schoolname=${schoolname}`,
      this.coreService.jsonhttpOptions
    );
  }

}
