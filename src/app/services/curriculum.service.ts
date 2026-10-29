import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { FAILURES_SHOWN_BY_CALLER } from 'src/app/interceptors/error-context';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';
import { PublicationOverview, PublishAnswer, PushOutcome, RetireAnswer } from 'src/app/shared/publication/publication.model';

/** What the curriculum delete answers (central: `DELETE curriculum/:id`). */
export interface DeleteAnswer {
  data: boolean;
  push: PushOutcome;
}

@Injectable({
  providedIn: 'root',
})
export class CurriculumService {
  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService
  ) {}
  getall(paging: IPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}curriculum`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  /** Deletes the curriculum. The answer says how pushing the published set to the learner server went (`push`). */
  delete(curriculumid: string) {
    return this.http.delete<DeleteAnswer>(
      `${this.coreService.CORE_API()}curriculum/${curriculumid}`,
      this.coreService.jsonhttpOptions
    );
  }

  /**
   * Where a curriculum stands: its publication state, whether it changed since, and what a publish now would record.
   * With `callerSaysFailures` the caller words every failure itself (the publish drawer), so the error interceptor stays
   * quiet; without it the interceptor's own notice is the one message (a list row whose state could not be read).
   */
  publication(curriculumid: string, callerSaysFailures = false): Observable<PublicationOverview> {
    return this.http
      .get<{ data: PublicationOverview }>(`${this.coreService.CORE_API()}curriculum/publication/${curriculumid}`, {
        ...this.coreService.jsonhttpOptions,
        ...(callerSaysFailures ? { context: new HttpContext().set(FAILURES_SHOWN_BY_CALLER, true) } : {}),
      })
      .pipe(map((r) => r.data));
  }

  /** Publishes the curriculum. Every failure is said by the caller (the interceptor stays quiet). */
  publish(curriculumid: string): Observable<PublishAnswer> {
    return this.http
      .put<{ data: PublishAnswer }>(`${this.coreService.CORE_API()}curriculum/publish/${curriculumid}`, {}, {
        ...this.coreService.jsonhttpOptions,
        context: new HttpContext().set(FAILURES_SHOWN_BY_CALLER, true),
      })
      .pipe(map((r) => r.data));
  }

  /** Retires the curriculum: learners lose it at their next sync, their progress is kept. Every failure is said by the caller. */
  retire(curriculumid: string): Observable<RetireAnswer> {
    return this.http
      .put<{ data: RetireAnswer }>(`${this.coreService.CORE_API()}curriculum/retire/${curriculumid}`, {}, {
        ...this.coreService.jsonhttpOptions,
        context: new HttpContext().set(FAILURES_SHOWN_BY_CALLER, true),
      })
      .pipe(map((r) => r.data));
  }

  activate(curriculumid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}curriculum/activate/${curriculumid}`,
      this.coreService.jsonhttpOptions
    );
  }

  deactivate(curriculumid: string) {
    return this.http.put(
      `${this.coreService.CORE_API()}curriculum/deactivate/${curriculumid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(curriculum: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}curriculum/${curriculum.curriculumid}`,
      {
        curriculumname: curriculum.curriculumname,
        curriculumdescription: curriculum.curriculumdescription,
        countryid: curriculum.countryid,
        subjectid: curriculum.subjectid,
      },
      this.coreService.jsonhttpOptions
    );
  }
  create(curriculumname: string, curriculumdescription: string, countryid: [string], subjectid: string) {
    return this.http.post(
      `${this.coreService.CORE_API()}curriculum/create`,
      {
        curriculumname,
        curriculumdescription,
        countryid,
        subjectid
      },
      this.coreService.jsonhttpOptions
    );
  }
  get(curriculumid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}curriculum/${curriculumid}`,
      this.coreService.jsonhttpOptions
    );
  }
  getByCountryid(countryid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}curriculum/country/${countryid}`,
      this.coreService.jsonhttpOptions
    );
  }
  map() {
    return this.http.get(
      `${this.coreService.CORE_API()}curriculum/map`,
      this.coreService.jsonhttpOptions
    );
  }
  tree() {
    return this.http.get(
      `${this.coreService.CORE_API()}curriculum/tree`,
      this.coreService.jsonhttpOptions
    );
  }

  curriculumtree(curriculumid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}curriculum/tree/${curriculumid}`,
      this.coreService.jsonhttpOptions
    );
  }

  cloudsync() {
    return this.http.post(
      `${this.coreService.CORE_API()}sync/cloud`,
      this.coreService.jsonhttpOptions
    );
  }

  getAllCurriculums(curid: string = '', studentid: string = '', standardid: string = '', schoolname: string = '') {
    return this.http.get(
      `${this.coreService.CORE_API()}curriculum/all?curid=${curid}&studentid=${studentid}&standardid=${standardid}&schoolname=${schoolname}`,
      this.coreService.jsonhttpOptions
    );
  }
}
