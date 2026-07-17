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
import { LessonService } from 'src/app/services/lesson.service';
import { LevelService } from 'src/app/services/level.service';
import { ReportService } from 'src/app/services/report.service';
import { SchoolService } from 'src/app/services/school.service';
import { StandardService } from 'src/app/services/standard.service';
import { StudentService } from 'src/app/services/student.service';
import saveAs from 'file-saver';

@Component({
    selector: 'app-last-completed-quiz',
    templateUrl: './last-completed-quiz.component.html',
    styleUrls: ['./last-completed-quiz.component.less'],
    standalone: false
})
export class StudentLastCompletedQuizComponent {
  dataloading = false;
  searchValue = '';
  total = 1;
  data: Array<any> = [];
  studentprogresses$?: Observable<any>;
  pageSize = 10;
  pageIndex = 1;
  filter: Array<IMultiFilter> = [];
  visible = false;
  online = false;

  searchFields = {
    curriculumid: '',
    gradeid: '',
    levelid: '',
    lessonid: '',
    countryid: '',
    schoolname: '',
    standardid: '',
    studentid: '',
  };
  // search curriculum
  searchCurChange$ = new BehaviorSubject('');
  curriculumList: any[] = [];
  isCurLoading = false;
  // search grade
  searchGradeChange$ = new BehaviorSubject({
    gradename: '',
    curid: '',
  });
  gradeList: any[] = [];
  isGradeLoading = false;
  // search level
  searchLevelChange$ = new BehaviorSubject({
    levelname: '',
    gradeid: '',
  });
  levelList: any[] = [];
  isLevelLoading = false;
  // search lesson
  searchLessonChange$ = new BehaviorSubject({
    lessonname: '',
    levelid: '',
  });
  lessonList: any[] = [];
  isLessonLoading = false;
  // search user
  searchUserChange$ = new BehaviorSubject({
    userid: '',
    schoolname: '',
    standardid: '',
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
    this.studentprogresses$ = this.reportService
      .getStudentsLastProgress(paging, this.online)
      .pipe(
        catchError((x: any) => []),
        first(),
        map((x: any) => {
          this.data = x.data.data;
          this.total = x.data.total;
          this.isLoadingOne = false;
          setTimeout(() => {
            this.dataloading = false;
          }, 400);
          return x.data.data;
        })
      );
    this.studentprogresses$.subscribe();
    // this.total = tempdata.data.total;
    // this.data = tempdata.data;
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
    private levelService: LevelService,
    private lessonService: LessonService,
    private countryService: CountryService,
    private schoolService: SchoolService,
    private route: ActivatedRoute,
  ) {
    // this.setupSearchCurriculum();
    // this.setupSearchGrade();
    // this.setupSearchLevel();
    // this.setupSearchLesson();
    this.setupSearchCountry();
    this.setupSearchSchool();
    this.setupSearchStandard();
    this.setupSearchUser();
    this.route.queryParams.subscribe(p => {
      this.online = p.online === 'true';
      if(this.online) this.setperms();
    });
  }

  downloadperms = ['view_current_level'];
  setperms() {
    this.downloadperms = ['view_current_level'];
  }

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
      schoolname: this.searchFields.schoolname ?? '',
      standardid: this.searchFields.standardid ?? '',
    });
  }

  getUserList = (search: {
    userid: string,
    schoolname: string,
    standardid: string,
  }): Observable<any> =>
    this.studentService
      .getAllUsers(search.userid, search.schoolname, search.standardid)
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

  resetValue1() {
    const temp1 = this.searchFields.countryid ?? '';
    for (const key in this.searchFields) {
      if (Object.prototype.hasOwnProperty.call(this.searchFields, key)) {
        (this.searchFields as any)[key] = '';
      }
    }
    this.searchFields.countryid = temp1;
  }
  resetValue2() {
    const temp = this.searchFields.schoolname ?? '';
    this.resetValue1();
    this.searchFields.schoolname = temp;
  }
  resetValue3() {
    const temp = this.searchFields.standardid ?? '';
    this.resetValue2();
    this.searchFields.standardid = temp;
  }

  isLoadingOne = false;

  prepareFilter(params?: NzTableQueryParams) {
    this.filter = [];
    this.filter.push({
      key: 'curriculumid',
      value: this.searchFields.curriculumid,
    });
    this.filter.push({ key: 'gradeid', value: this.searchFields.gradeid });
    this.filter.push({ key: 'levelid', value: this.searchFields.levelid });
    this.filter.push({ key: 'lessonid', value: this.searchFields.lessonid });
    this.filter.push({ key: 'countryid', value: this.searchFields.countryid });
    this.filter.push({
      key: 'schoolname',
      value: this.searchFields.schoolname,
    });
    this.filter.push({ key: 'studentid', value: this.searchFields.studentid });
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

  cleanBody = (body: any) => {
    for (const key in body) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        if(body[key] == null) body[key] = '';
      }
    }
  }

  downloading = false;
  downloadStudent() {
    this.cleanBody(this.searchFields);
    this.downloading = true;
    const { filter } = this.prepareFilter();
    return this.reportService.downloadCurrentQuizzes({
      filter: filter,
      pageindex: 1,
      pagesize: 1000,
    }, this.online)
      .pipe(
        first(),
        catchError((x) => {
          this.downloading = false;
          return x;
        })
      )
      .subscribe((x: any) => {
        saveAs(x as Blob, `report-current-level.csv`);
        this.downloading = false;
      });
  }
}
