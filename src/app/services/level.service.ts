import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root'
})
export class LevelService {

  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService,
  ) { }
  getall(paging: IPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}level`, paging,
      this.coreService.jsonhttpOptions
    );
  }

  delete(levelid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}level/${levelid}`,
      this.coreService.jsonhttpOptions
    );
  }

  activate(levelid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}level/activate/${levelid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deactivate(levelid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}level/deactivate/${levelid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(level: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}level/${level.levelid}`, {
      levelname: level.levelname,
      leveldescription: level.leveldescription,
      gradeid: level.gradeid,
      levelorder: level.levelorder,
      quiz_points: level.quiz_points,
      passing_points: level.passing_points
    },
      this.coreService.jsonhttpOptions
    );
  }
  create(levelname: string, leveldescription: string, gradeid: string, levelorder: number, quiz_points: number, passing_points: number) {
    return this.http.post(
      `${this.coreService.CORE_API()}level/create`, {
      levelname,
      leveldescription,
      gradeid,
      levelorder,
      quiz_points,
      passing_points
    },
      this.coreService.jsonhttpOptions
    );
  }
  get(levelid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}level/${levelid}`,
      this.coreService.jsonhttpOptions
    );
  }

  getAllLevels(levelname: string = '', gradeid: string = '') {
    return this.http.get(
      `${this.coreService.CORE_API()}level/all?gradeid=${gradeid}&level=${levelname}`,
      this.coreService.jsonhttpOptions
    );
  }

}
