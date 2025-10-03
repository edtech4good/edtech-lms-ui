import { Component, OnInit } from '@angular/core';
import { FeedbackService } from '../../../services/feedback.service';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { IFilter, IMultiFilter, IMultiPaging, IPaging } from 'src/app/models/IPaging';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { catchError, debounceTime, first, map, switchMap } from 'rxjs/operators';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { CountryService } from 'src/app/services/country.service';
import { SchoolService } from 'src/app/services/school.service';
import { teacherfeedback } from '../../report/models/Search.interface';

@Component({
  selector: 'app-feedback-index',
  templateUrl: './feedback-index.component.html',
  styleUrls: ['./feedback-index.component.less']
})
export class FeedbackIndexComponent implements OnInit{
  dataloading = false;
  searchValue = '';
  total = 1;
  data: Array<any> = [];
  pageSize = 10;
  pageIndex = 1;
  filter: Array<IMultiFilter> = [];
  visible = false;
  filterField = {
    feedbacks: []
  }

  searchFields: teacherfeedback = {
    countryid: '',
    schoolname: '',
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

  async loadDataFromServer(paging: IMultiPaging) {
    this.pageIndex = paging.pageindex || 1;
    this.filter = paging.filter || [];
    this.pageSize = paging.pagesize || 10;
    // const tempdata: any = await
    this.feedbackService
      .getall(paging)
      .pipe(first())
      .subscribe(
        (tempdata: any) => {
          this.total = tempdata.data.total;
          this.data = tempdata.data.data;
          this.isLoadingOne = false;
        },
        (error) => {
          if(error) {
            this.dataloading = false;
          }
        },
        () => {
          setTimeout(() => {
            this.dataloading = false;
          }, 400);
        }
      );
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = params;
    // this.assignFilterNewValue(filter);
    await this.loadDataFromServer({
      filter: this.filter,
      pageindex: pageIndex,
      pagesize: pageSize,
    });
  }

  deletetag = async (feedbackid: string) => {
    await this.feedbackService.delete(feedbackid).pipe(first()).toPromise();
    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
    this.notification.create(
      'success',
      'Success',
      'Feedback deleted sucessfully'
    );
  };

  constructor(
    private readonly feedbackService: FeedbackService,
    private readonly notification: NzNotificationService,
    private countryService: CountryService,
    private schoolService: SchoolService,
  ) {}

  ngOnInit(): void {
    this.dataloading = true;
    this.buildFilter();

    this.setupSearchCountry();
    this.setupSearchSchool();
  }

  reset(): void {
    this.searchValue = '';
    this.search();
  }

  // assignFilterNewValue = (filter: Array<{ key: string; value: any; }> = []) => {
  //   // assign schoolname
  //   if (this.searchValue.length > 0) {
  //     this.filter = this.filter.map(obj => obj.key === 'feedbackid' ? { ...obj , value: this.searchValue} : obj);
  //   }
  //   // assign countryname
  //   if (filter.length > 0) {
  //     this.filter = this.filter.map(obj => {
  //       const field = filter.length > 0 ? filter.find(x => (x.key === obj.key)) : null;
  //       return field ? { ...obj , value: field.value} : obj;
  //     });
  //   }
  // }

  buildFilter = async () => {
    // load all feedback
    this.filterField.feedbacks = await this.feedbackService.getall({ pagesize: 200 }).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => {
        return (x.data.data).map((feedback: any) => ({
          text: feedback.feedback,
          value: feedback.feedbackid
        }));
      })
    ).toPromise();
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

  isLoadingOne = false;

  prepareFilter(params?: NzTableQueryParams) {
    this.filter = [];
    this.filter.push({ key: 'countryid', value: this.searchFields.countryid });
    this.filter.push({ key: 'schoolname', value: this.searchFields.schoolname });
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

  resetValue0() {
    const temp1 = this.searchFields.countryid ?? '';
    for (const key in this.searchFields) {
      if (Object.prototype.hasOwnProperty.call(this.searchFields, key)) {
        (this.searchFields as any)[key] = '';
      }
    }
    this.searchFields.countryid = temp1;
  }
}
