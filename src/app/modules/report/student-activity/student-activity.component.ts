import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, debounceTime, first, map, switchMap } from 'rxjs/operators';
import {
  IFilter,
  IMultiFilter,
  IMultiPaging,
  IPaging,
} from 'src/app/models/IPaging';
import { CountryService } from 'src/app/services/country.service';
import { ReportService } from 'src/app/services/report.service';
import { SchoolService } from 'src/app/services/school.service';
import { StandardService } from 'src/app/services/standard.service';
import { StudentService } from 'src/app/services/student.service';
import { studentactivitysearch } from '../models/Search.interface';
import saveAs from 'file-saver';

@Component({
  selector: 'app-student-activity',
  templateUrl: './student-activity.component.html',
  styleUrls: ['./student-activity.component.less'],
})
export class StudentActivityComponent implements OnInit {
  dataloading = false;
  searchValue = '';
  total = 1;
  data: Array<any> = [];
  studentactivity$?: Observable<any>;
  pageSize = 10;
  pageIndex = 1;
  filter: Array<IMultiFilter> = [];
  visible = false;
  online = false;

  searchFields: studentactivitysearch = {
    countryid: '',
    schoolname: '',
    standardid: '',
    studentid: '',
    startDate: '',
    endDate: '',
  };
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
  // search user
  searchUserChange$ = new BehaviorSubject({
    userid: '',
    schoolname: '',
    standard: '',
  });
  userList: any[] = [];
  isUserLoading = false;

  async loadDataFromServer(paging: IMultiPaging) {
    this.dataloading = true;
    this.pageIndex = paging.pageindex || 1;
    this.filter = paging.filter || [];
    this.pageSize = paging.pagesize || 10;
    this.studentactivity$ = this.reportService.getStudentsActivity(paging, this.online).pipe(
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
    this.studentactivity$.subscribe();
    // this.total = tempdata.data.total;
    // this.data = tempdata.data;
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = this.prepareFilter(params);
    // this.isLoadingOne = true;
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
    private countryService: CountryService,
    private schoolService: SchoolService,
    private studentService: StudentService,
    private route: ActivatedRoute,
  ) {}
  ngOnInit(): void {
    this.setupSearchCountry();
    this.setupSearchSchool();
    this.setupSearchStandard();
    this.setupSearchUser();
    this.route.queryParams.subscribe(p => {
      this.online = (p.online === 'true') ?? false;
      if(this.online) this.setperms();
    });
  }

  downloadperms = ['view_active_status'];
  setperms() {
    this.downloadperms = ['view_active_status'];
  }

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
      schoolname: this.searchFields.schoolname ?? '',
      standard: this.searchFields.standardid ?? ''
    });
  }

  getUserList = (search: {
    userid: string,
    schoolname: string,
    standard: string
  }): Observable<any> =>
    this.studentService
      .getAllUsers(search.userid, search.schoolname, search.standard)
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
    this.filter.push({ key: 'schoolname', value: this.searchFields.schoolname });
    this.filter.push({ key: 'standard', value: this.searchFields.standardid });
    this.filter.push({ key: 'studentid', value: this.searchFields.studentid });
    this.filter.push({ key: 'startDate', value: this.searchFields.startDate });
    this.filter.push({ key: 'endDate', value: this.searchFields.endDate });
    return {
      pageIndex: params?.pageIndex ?? this.pageIndex,
      pageSize: params?.pageSize ?? this.pageSize,
      filter: this.filter,
    };
  }

  async search(): Promise<void> {
    this.pageIndex = 1;
    const { pageSize, pageIndex, filter } = this.prepareFilter();
    this.isLoadingOne = true;
    await this.loadDataFromServer({
      filter: this.filter,
      pageindex: pageIndex,
      pagesize: pageSize,
    });
  }

  startValue: Date | null = null;
  endValue: Date | null = null;

  disabledStartDate = (startValue: Date): boolean => {
    if (!startValue || !this.searchFields.endDate) {
      return false;
    }
    return startValue.getTime() > (this.searchFields.endDate as Date).getTime();
  };

  disabledEndDate = (endValue: Date): boolean => {
    if (!endValue || !this.searchFields.startDate) {
      return false;
    }
    return endValue.getTime() <= (this.searchFields.startDate as Date).getTime();
  };

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
    return this.reportService.downloadStudentStatus({
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
        saveAs(x as Blob, `report-student-activity-status.csv`);
        this.downloading = false;
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
    const temp2 = this.searchFields.standardid ?? '';
    this.resetValue1();
    this.searchFields.standardid = temp2;
  }
}
