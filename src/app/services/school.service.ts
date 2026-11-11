import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { FIELD_ERRORS_INLINE } from 'src/app/interceptors/error-context';
import { isOffered } from 'src/app/shared/publication/published-curricula';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { IMultiPaging, IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';
import { ResponseBody } from '../models/response.model';
import { LineChartFormat } from '../modules/dashboard/index/models/LineChartFormat';

@Injectable({
  providedIn: 'root',
})
export class SchoolService {
  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService,
    private readonly curriculumService: CurriculumService
  ) {}
  getall(paging: IMultiPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}school`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  /**
   * Create and update opt out of the error interceptor's 400, 403 and 404 notices: a school name central refuses (one a
   * school held before) is shown under the name field, and the form says any other refusal itself (school-form-failure.ts).
   */
  private get fieldErrorsInline() {
    return { ...this.coreService.jsonhttpOptions, context: new HttpContext().set(FIELD_ERRORS_INLINE, true) };
  }

  delete(schoolid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}school/${schoolid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(school: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}school/update/${school.schoolid}`,
      {
        schoolname: school.schoolname,
        countryid: school.countryid,
        curriculums: school.curriculums,
        uitheme: school.uitheme,
      },
      this.fieldErrorsInline
    );
  }
  create(schoolname: string, countryid: string, curriculums: Array<string>) {
    return this.http.post(
      `${this.coreService.CORE_API()}school/create`,
      {
        schoolname,
        countryid,
        curriculums
      },
      this.fieldErrorsInline
    );
  }
  get(schoolid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}school/${schoolid}`,
      this.coreService.jsonhttpOptions
    );
  }
  getCurriculums(schoolid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}school/${schoolid}/curriculums`,
      this.coreService.jsonhttpOptions
    );
  }
  /**
   * The school's curricula that learners can be placed in: `getCurriculums` without the ones never published or retired
   * (see published-curricula.ts). Each curriculum's state is read on its own (the route is `curriculum/publication/:id`);
   * a read that fails leaves that curriculum in, and central still refuses an unpublished one.
   */
  getPublishedCurriculums(schoolid: string): Observable<any> {
    return this.getCurriculums(schoolid).pipe(
      switchMap((answer: any) => {
        const rows: any[] = Array.isArray(answer?.data) ? answer.data : [];
        // A deleted curriculum comes back without a name or an id: there is nothing to read for it, and the forms drop it.
        const reads = rows.map((row) =>
          row?.curriculumid && !row.isdeleted
            ? this.curriculumService.publication(row.curriculumid, true).pipe(
                map((overview) => overview?.publicationstatus),
                catchError(() => of(undefined))
              )
            : of(undefined)
        );
        if (reads.length === 0) return of(answer);
        return forkJoin(reads).pipe(map((states) => ({ ...answer, data: rows.filter((_row, i) => isOffered(states[i])) })));
      })
    );
  }

  getAllSchools(schoolname: string = '', countryid: string = '') {
    return this.http.get(
      `${this.coreService.CORE_API()}school/all?countryid=${countryid}&school=${schoolname}`,
      this.coreService.jsonhttpOptions
    );
  }

  getSchoolsCurriculum(curriculumid: string = '') {
    return this.http.get(
      `${this.coreService.CORE_API()}school/curriculumid?curriculumid=${curriculumid}`,
      this.coreService.jsonhttpOptions
    );
  }

  // school-contribute dashboard
  getSchoolByCountryId(countryid: string) {
    return this.http.get<ResponseBody<Array<LineChartFormat>>>(
      `${this.coreService.CORE_API()}school/dashboard/${countryid}`,
      this.coreService.jsonhttpOptions
    )
  }
}
