import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root'
})
export class LessonService {

  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService,
  ) { }
  getall(paging: IPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}lesson`, paging,
      this.coreService.jsonhttpOptions
    );
  }

  delete(lessonid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}lesson/${lessonid}`,
      this.coreService.jsonhttpOptions
    );
  }

  activate(lessonid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/activate/${lessonid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deactivate(lessonid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/deactivate/${lessonid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(lesson: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}lesson/${lesson.lessonid}`, {
      lessonname: lesson.lessonname,
      lessondescription: lesson.lessondescription,
      levelid: lesson.levelid,
      lessonorder: lesson.lessonorder,
      total_points: lesson.total_points,
      passing_points: lesson.passing_points
    },
      this.coreService.jsonhttpOptions
    );
  }
  create(lessonname: string, lessondescription: string, levelid: string, lessonorder: number, total_points: number, passing_points: number) {
    return this.http.post(
      `${this.coreService.CORE_API()}lesson/create`, {
      lessonname,
      lessondescription,
      levelid,
      lessonorder,
      total_points,
      passing_points
    },
      this.coreService.jsonhttpOptions
    );
  }
  get(lessonid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}lesson/${lessonid}`,
      this.coreService.jsonhttpOptions
    );
  }

  getAllLessons(lessonname: string = '', levelid: string = '') {
    return this.http.get(
      `${this.coreService.CORE_API()}lesson/all?levelid=${levelid}&lessonname=${lessonname}`,
      this.coreService.jsonhttpOptions
    );
  }

}
