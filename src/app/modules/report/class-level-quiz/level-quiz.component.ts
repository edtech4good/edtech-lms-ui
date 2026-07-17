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
    selector: 'app-class-level-quiz',
    templateUrl: './level-quiz.component.html',
    styleUrls: ['./level-quiz.component.less'],
    standalone: false
})
export class ClassLevelQuizComponent implements OnInit {
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
  searchCurChange$ = new BehaviorSubject({
    curname: '',
    studentid: '',
    standardid: '',
    schoolname: '',
  });
  curList: any[] = [];
  isCurLoading = false;
  // search grade
  searchGradeChange$ = new BehaviorSubject({
    gradename: '',
    curid: '',
    schoolname: '',
    standardid: '',
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
    standardid: '',
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
    this.studentprogresses$ = this.reportService
      .getClassLevelQuiz(paging, this.online)
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
    this.setupSearchCur();
    this.setupSearchCountry();
    this.setupSearchSchool();
    this.setupSearchStandard();
    this.setupSearchGrade();
    this.setupSearchLevel();
    this.setupSearchLesson();
    this.setupSearchUser();
    this.route.queryParams.subscribe(p => {
      this.online = p.online === 'true';
      if(this.online) this.setperms();
    });
  }

  studentquizscoreperms = ['view_student_level_quiz'];
  classquizscoreperms = ['view_student_level_quiz'];
  downloadperms = ['view_student_level_quiz'];
  setperms() {
    this.studentquizscoreperms = ['view_online_student_level_quiz'];
    this.classquizscoreperms = ['view_online_student_level_quiz'];
    this.downloadperms = ['view_online_student_level_quiz'];
  }

  setupSearchCur() {
    const curList$: Observable<string[]> = this.searchCurChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getCurList));
    curList$.subscribe((data) => {
      this.curList = data;
      this.isCurLoading = false;
    });
  }

  onSearchCur(value: string): void {
    this.isCurLoading = true;
    this.searchCurChange$.next({
      curname: value,
      studentid: this.searchFields.studentid ?? '',
      standardid: this.searchFields.standardid ?? '',
      schoolname: this.searchFields.schoolname ?? '',
    });
  }

  getCurList = (search: {
    curname: string,
    studentid: string,
    standardid: string,
    schoolname: string,
  }): Observable<any> =>
    this.curriculumService
      .getAllCurriculums(search.curname, search.studentid, search.standardid, search.schoolname)
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
      curid: this.searchFields.curriculumid ?? '',
      schoolname: this.searchFields.schoolname ?? '',
      standardid: this.searchFields.standardid ?? '',
    });
  }

  getGradeList = (search: {
    gradename: string,
    curid: string,
    schoolname: string,
    standardid: string
  }): Observable<any> =>
    this.gradeService
      .getAllGrades(search.gradename, search.curid, '', search.standardid, search.schoolname)
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

  setupSearchLesson() {
    const lessonList$: Observable<string[]> = this.searchLessonChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getLessonList));
    lessonList$.subscribe((data) => {
      this.lessonList = data;
      this.isLessonLoading = false;
    });
  }

  onSearchLesson(value: string): void {
    this.isLessonLoading = true;
    this.searchLessonChange$.next({
      lessonname: value,
      levelid: this.searchFields.levelid ?? '',
    });
  }

  getLessonList = (search: {
    lessonname: string;
    levelid: string;
  }): Observable<any> =>
    this.lessonService
      .getAllLessons(search.lessonname, search.levelid)
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

  resetValue0() {
    const temp1 = this.searchFields.countryid ?? '';
    for (const key in this.searchFields) {
      if (Object.prototype.hasOwnProperty.call(this.searchFields, key)) {
        (this.searchFields as any)[key] = '';
      }
    }
    this.searchFields.countryid = temp1;
  }
  resetValue1() {
    const temp2 = this.searchFields.schoolname ?? '';
    this.resetValue0();
    this.searchFields.schoolname = temp2;
  }
  resetValue2() {
    const temp = this.searchFields.standardid ?? '';
    this.resetValue1();
    this.searchFields.standardid = temp;
  }
  resetValue3() {
    const temp = this.searchFields.curriculumid ?? '';
    this.resetValue2();
    this.searchFields.curriculumid = temp;
  }
  resetValue4() {
    const temp = this.searchFields.gradeid ?? '';
    this.resetValue3();
    this.searchFields.gradeid = temp;
  }

  onSearchUser(value: string): void {
    this.isUserLoading = true;
    this.searchUserChange$.next({
      userid: value,
      standardid: this.searchFields.standardid ?? '',
      schoolname: this.searchFields.schoolname ?? '',
    });
  }

  getUserList = (search: {
    userid: string,
    standardid: string,
    schoolname: string
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

  isLoadingOne = false;

  prepareFilter(params?: NzTableQueryParams) {
    this.filter = [];
    this.filter.push({ key: 'levelid', value: this.searchFields.levelid });
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
    return this.reportService.downloadClassLevelQuizzes({
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
        saveAs(x as Blob, `report-level-quiz.csv`);
        this.downloading = false;
      });
  }
}
