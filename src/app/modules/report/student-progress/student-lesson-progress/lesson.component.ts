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
import { studentlessonprogresssearch } from '../../models/Search.interface';

@Component({
  selector: 'app-student-lesson-progress',
  templateUrl: './lesson.component.html',
  styleUrls: ['./lesson.component.less'],
})
export class StudentLessonProgressComponent implements OnInit {
  dataloading = false;
  searchValue = '';
  total = 1;
  data: Array<any> = [];
  studentlessonprogress$?: Observable<any>;
  pageSize = 10;
  pageIndex = 1;
  filter: Array<IMultiFilter> = [];
  visible = false;
  online = false;

  currentStudent: any;

  searchFields = {
    countryid: '',
    schoolname: '',
    studentid: '',
    gradeid: '',
    levelid: '',
  };
  // search curriculum
  searchCurChange$ = new BehaviorSubject('');
  curriculumList: any[] = [];
  isCurLoading = false;
  // search grade
  searchGradeChange$ = new BehaviorSubject({
    gradename: 'string',
    studentid: 'string',
  });
  gradeList: any[] = [];
  isGradeLoading = false;
  // search level
  searchLevelChange$ = new BehaviorSubject({
    levelname: 'string',
    gradeid: 'string',
  });
  levelList: any[] = [];
  isLevelLoading = false;
  // search lesson
  searchLessonChange$ = new BehaviorSubject({
    lessonname: 'string',
    levelid: 'string',
  });
  lessonList: any[] = [];
  isLessonLoading = false;
  // search user
  searchUserChange$ = new BehaviorSubject({
    userid: 'string',
    schoolname: 'string',
  });
  userList: any[] = [];
  isUserLoading = false;
  // search country
  searchCountryChange$ = new BehaviorSubject({
    countryname: 'string',
  });
  countryList: any[] = [];
  isCountryLoading = false;
  // search school
  searchSchoolChange$ = new BehaviorSubject({
    schoolname: 'string',
    countryid: 'string',
  });
  schoolList: any[] = [];
  isSchoolLoading = false;

  async loadDataFromServer(paging: IMultiPaging) {
    this.dataloading = true;
    this.pageIndex = paging.pageindex || 1;
    this.filter = paging.filter || [];
    this.pageSize = paging.pagesize || 10;
    this.studentlessonprogress$ = this.reportService
      .getStudentsLessonProgress(paging, this.online)
      .pipe(
        catchError((x: any) => []),
        first(),
        map((x: any) => {
          this.data = x.data.data;
          this.currentStudent = x.data.student;
          this.total = x.data.total;
          this.isLoadingOne = false;
          setTimeout(() => {
            this.dataloading = false;
          }, 400);
          return x.data.data;
        })
      );
    this.studentlessonprogress$.subscribe();
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
  ) {}

  ngOnInit(): void {
    this.setupSearchCountry();
    this.setupSearchSchool();
    this.setupSearchUser();
    this.setupSearchGrade();
    this.setupSearchLevel();
    this.route.queryParams.subscribe(p => {
      this.online = (p.online === 'true') ?? false;
    });
  }

  setupSearchCurriculum() {
    const curriculumList$: Observable<string[]> = this.searchCurChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getCurriculumList));
    curriculumList$.subscribe((data) => {
      this.curriculumList = data;
      this.isCurLoading = false;
    });
  }

  onSearchCur(value: string): void {
    this.isCurLoading = true;
    this.searchCurChange$.next(value);
    this.onSearchGrade('');
  }

  getCurriculumList = (cur: string = ''): Observable<any> =>
    this.curriculumService
      .getAllCurriculums(cur)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

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
      studentid: this.searchFields.studentid ?? '',
    });
  }

  getGradeList = (search: {
    gradename: string;
    studentid: string;
  }): Observable<any> =>
    this.gradeService
      .getAllGrades(search.gradename, '', search.studentid)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

  setupSearchLevel() {
    const levelList$: Observable<string[]> = this.searchLevelChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getLevelList));
    levelList$.subscribe((data) => {
      this.levelList = data;
      this.isLevelLoading = false;
    });
  }

  onSearchLevel(value: string): void {
    this.isLevelLoading = true;
    this.searchLevelChange$.next({
      levelname: value,
      gradeid: this.searchFields.gradeid ?? '',
    });
  }

  getLevelList = (search: {
    levelname: string;
    gradeid: string;
  }): Observable<any> =>
    this.levelService
      .getAllLevels(search.levelname, search.gradeid)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

  // setupSearchLesson() {
  //   const lessonList$: Observable<string[]> = this.searchLessonChange$
  //     .asObservable()
  //     .pipe(debounceTime(500))
  //     .pipe(switchMap(this.getLessonList));
  //   lessonList$.subscribe((data) => {
  //     this.lessonList = data;
  //     this.isLessonLoading = false;
  //   });
  // }

  // onSearchLesson(value: string): void {
  //   this.isLessonLoading = true;
  //   this.searchLessonChange$.next({
  //     lessonname: value,
  //     levelid: this.searchFields.levelid ?? '',
  //   });
  // }

  // getLessonList = (search: {
  //   lessonname: string;
  //   levelid: string;
  // }): Observable<any> =>
  //   this.lessonService
  //     .getAllLessons(search.lessonname, search.levelid)
  //     .pipe(
  //       catchError(() => of({ results: [] })),
  //       map((res: any) => res.data)
  //     )
  //     .pipe(
  //       map((list: any) => {
  //         return list;
  //       })
  //     );

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
    this.filter.push({ key: 'countryid', value: this.searchFields.countryid });
    this.filter.push({
      key: 'schoolname',
      value: this.searchFields.schoolname,
    });
    this.filter.push({ key: 'studentid', value: this.searchFields.studentid });
    this.filter.push({ key: 'gradeid', value: this.searchFields.gradeid });
    this.filter.push({ key: 'levelid', value: this.searchFields.levelid });
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
}
