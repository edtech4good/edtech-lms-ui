import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { BehaviorSubject, Observable, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  first,
  map,
  switchMap,
} from 'rxjs/operators';
import {
  IFilter,
  IMultiFilter,
  IMultiPaging,
  IPaging,
} from 'src/app/models/IPaging';
import { CountryService } from 'src/app/services/country.service';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { GradeService } from 'src/app/services/grade.service';
import { ReportService } from 'src/app/services/report.service';
import { SchoolService } from 'src/app/services/school.service';
import { StandardService } from 'src/app/services/standard.service';
import { StudentService } from 'src/app/services/student.service';
import { studentactivitysearch, studentgradesearch } from '../../models/Search.interface';

@Component({
    selector: 'app-student-grade-progress',
    templateUrl: './grade.component.html',
    styleUrls: ['./grade.component.less'],
    standalone: false
})
export class StudentGradeProgressComponent implements OnInit {
  dataloading = false;
  searchValue = '';
  total = 1;
  currentStudent: any;
  data: Array<any> = [];
  studentgradeprogress$?: Observable<any>;
  pageSize = 10;
  pageIndex = 1;
  filter: Array<IMultiFilter> = [];
  visible = false;
  online = false;

  searchFields = {
    gradeid: '',
    countryid: '',
    schoolname: '',
    studentid: '',
    standardid: '',
  };
  // search curriculum
  searchCurChange$ = new BehaviorSubject('');
  curriculumList: any[] = [];
  isCurLoading = false;
  // search grade
  searchGradeChange$ = new BehaviorSubject({
    gradename: '',
    standardid: '',
    schoolname: '',
  });
  gradeList: any[] = [];
  isGradeLoading = false;
  // search user
  searchUserChange$ = new BehaviorSubject({
    userid: '',
    schoolname: '',
  });
  userList: any[] = [];
  isUserLoading = false;
  // search country
  searchCountryChange$ = new BehaviorSubject({
    countryname: '',
  });
  countryList: any[] = [];
  isCountryLoading = false;
  // search school
  searchSchoolChange$ = new BehaviorSubject({
    schoolname: '',
    countryid: '',
  });
  schoolList: any[] = [];
  isSchoolLoading = false;
  // search standard
  searchStandardChange$ = new BehaviorSubject({
    standardname: '',
    schoolname: '',
  });
  standardList: any[] = [];
  isStandardLoading = false;


  async loadDataFromServer(paging: IMultiPaging) {
    this.dataloading = true;
    this.pageIndex = paging.pageindex || 1;
    this.filter = paging.filter || [];
    this.pageSize = paging.pagesize || 10;
    this.studentgradeprogress$ = this.reportService
      .getStudentsGradeProgress(paging, this.online)
      .pipe(
        catchError((x: any) => []),
        first(),
        map((x: any) => {
          this.data = x.data.data;
          this.total = x.data.total;
          this.currentStudent = x.data.student;
          this.isLoadingOne = false;
          setTimeout(() => {
            this.dataloading = false;
          }, 400);
          return x.data.data;
        })
      );
    this.studentgradeprogress$.subscribe();
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = this.prepareFilter(params);
    this.isLoadingOne = true;
    await this.loadDataFromServer({
      filter: this.filter,
      pageindex: pageIndex,
      pagesize: pageSize,
    });
  }

  constructor(
    private readonly standardService: StandardService,
    private readonly notification: NzNotificationService,
    private reportService: ReportService,
    private curriculumService: CurriculumService,
    private gradeService: GradeService,
    private studentService: StudentService,
    private countryService: CountryService,
    private schoolService: SchoolService,
    private route: ActivatedRoute,
  ) {}
  ngOnInit(): void {
    this.setupSearchCountry();
    this.setupSearchSchool();
    this.setupSearchStandard();
    this.setupSearchGrade();
    this.route.queryParams.subscribe(p => {
      this.online = p.online === 'true';
    });
  }

  // setupSearchCurriculum() {
  //   const curriculumList$: Observable<string[]> = this.searchCurChange$
  //     .asObservable()
  //     .pipe(debounceTime(500))
  //     .pipe(switchMap(this.getCurriculumList));
  //   curriculumList$.subscribe((data) => {
  //     this.curriculumList = data;
  //     this.isCurLoading = false;
  //   });
  // }

  // onSearchCur(value: string): void {
  //   this.isCurLoading = true;
  //   this.searchCurChange$.next(value);
  //   this.onSearchGrade('');
  // }

  // getCurriculumList = (cur: string = ''): Observable<any> =>
  //   this.curriculumService
  //     .getAllCurriculums(cur)
  //     .pipe(
  //       catchError(() => of({ results: [] })),
  //       map((res: any) => res.data)
  //     )
  //     .pipe(
  //       map((list: any) => {
  //         return list;
  //       })
  //     );

  setupSearchGrade() {
    const gradeList$: Observable<string[]> = this.searchGradeChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getGradeList));
    gradeList$.subscribe((data) => {
      this.gradeList = data;
      this.isGradeLoading = false;
    });
  }

  onSearchGrade(value: string): void {
    this.isGradeLoading = true;
    this.searchGradeChange$.next({
      gradename: value,
      standardid: this.searchFields.standardid ?? '',
      schoolname: this.searchFields.schoolname ?? '',
    });
  }

  getGradeList = (search: {
    gradename: string,
    standardid: string,
    schoolname: string
  }): Observable<any> =>
    this.gradeService
      .getAllGrades(search.gradename, '', '', search.standardid, search.schoolname)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

  setupSearchCountry() {
    const countryList$: Observable<string[]> = this.searchCountryChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getCountryList));
    countryList$.subscribe((data) => {
      this.countryList = data;
      this.isCountryLoading = false;
    });
  }

  onSearchCountry(value: string): void {
    this.isCountryLoading = true;
    this.searchCountryChange$.next({
      countryname: value,
    });
  }

  getCountryList = (search: { countryname: string }): Observable<any> =>
    this.countryService
      .getAllCountries(search.countryname)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

  setupSearchSchool() {
    const schoolList$: Observable<string[]> = this.searchSchoolChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getSchoolList));
    schoolList$.subscribe((data) => {
      this.schoolList = data;
      this.isSchoolLoading = false;
    });
  }

  onSearchSchool(value: string): void {
    this.isSchoolLoading = true;
    this.searchSchoolChange$.next({
      schoolname: value,
      countryid: this.searchFields.countryid ?? '',
    });
  }

  getSchoolList = (search: {
    schoolname: string;
    countryid: string;
  }): Observable<any> =>
    this.schoolService
      .getAllSchools(search.schoolname, search.countryid)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

  setupSearchStandard() {
    const standardList$: Observable<string[]> = this.searchStandardChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getStandardList));
    standardList$.subscribe((data) => {
      this.standardList = data;
      this.isStandardLoading = false;
    });
  }

  onSearchStandard(value: string): void {
    this.isStandardLoading = true;
    this.searchStandardChange$.next({
      standardname: value,
      schoolname: this.searchFields.schoolname ?? ''
    });
  }

  getStandardList = (search: {
    schoolname: string;
    standardname: string;
  }): Observable<any> =>
    this.standardService
      .getAllStandards(search.standardname, search.schoolname)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

  setupSearchUser() {
    const userList$: Observable<string[]> = this.searchUserChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getUserList));
    userList$.subscribe((data) => {
      this.userList = data;
      this.isUserLoading = false;
    });
  }

  onSearchUser(value: string): void {
    this.isUserLoading = true;
    this.searchUserChange$.next({
      userid: value,
      schoolname: this.searchFields.schoolname,
    });
  }

  getUserList = (search: {
    userid: string;
    schoolname: string;
  }): Observable<any> =>
    this.studentService
      .getAllUsers(search.userid, search.schoolname)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

  isLoadingOne = false;

  prepareFilter(params?: NzTableQueryParams) {
    this.filter = [];
    this.filter.push({ key: 'gradeid', value: this.searchFields.gradeid });
    this.filter.push({ key: 'standard', value: this.searchFields.standardid });
    return {
      pageIndex: params?.pageIndex ?? this.pageIndex,
      pageSize: params?.pageSize ?? this.pageSize,
      filter: this.filter,
    };
  }

  async search(): Promise<void> {
    const { pageSize, pageIndex, filter } = this.prepareFilter();
    this.isLoadingOne = true;
    await this.loadDataFromServer({
      filter: this.filter,
      pageindex: pageIndex,
      pagesize: pageSize,
    });
  }

  resetValue1() {
    const temp1 = this.searchFields.countryid ?? '', temp2 = this.searchFields.schoolname ?? '';
    for (const key in this.searchFields) {
      if (Object.prototype.hasOwnProperty.call(this.searchFields, key)) {
        (this.searchFields as any)[key] = '';
      }
    }
    this.searchFields.countryid = temp1;
    this.searchFields.schoolname = temp2;
  }
  resetValue2() {
    const temp = this.searchFields.studentid ?? '';
    this.resetValue1();
    this.searchFields.studentid = temp;
  }
  resetValue3() {
    const temp = this.searchFields.gradeid ?? '';
    this.resetValue2();
    this.searchFields.gradeid = temp;
  }
}
