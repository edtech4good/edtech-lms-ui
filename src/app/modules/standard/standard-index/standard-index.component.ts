import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { catchError, first, map } from 'rxjs/operators';
import { IFilter, IPaging } from 'src/app/models/IPaging';
import { StandardService } from 'src/app/services/standard.service';
import { SchoolService } from '../../../services/school.service';
import { IMultiFilter, IMultiPaging } from '../../../models/IPaging';
import { object, x } from 'joi';
import { organisationOf, withOrganisationFilter } from 'src/app/shared/owner/owner-view';
import { OwnerViewService } from 'src/app/shared/owner/owner-view.service';
import { NOT_FOUND_MESSAGE, NOT_FOUND_TOAST_KEY } from 'src/app/interceptors/error.interceptor';
import { classDeleteRefusalText } from './standard-delete-refusal';
import { StickyNoticeService, pushOf } from 'src/app/shared/notices/sticky-notice.service';

@Component({
    selector: 'app-standard-index',
    templateUrl: './standard-index.component.html',
    styleUrls: ['./standard-index.component.less'],
    standalone: false
})
export class StandardIndexComponent implements OnInit {
  readonly owner = inject(OwnerViewService);
  /** The organisation the platform view is narrowed to (null: all). */
  get organisationFilter(): string | null {
    return organisationOf(this.filter);
  }
  async onOwnerFilter(organisationid: string | null) {
    await this.loadDataFromServer({
      filter: withOrganisationFilter(this.filter, organisationid),
      pageindex: 1,
      pagesize: this.pageSize,
    });
  }

  dataloading = false;
  searchValue = '';
  filterSchool?: [];
  filterField = {
    school: [],
  }
  total = 1;
  data: Array<any> = [];
  pageSize = 10;
  pageIndex = 1;
  filter: Array<IMultiFilter> = [
    { key: 'standardname', value: ''},
    { key: 'schoolid', value: ''}
  ];
  visible = false;

  async loadDataFromServer(paging: IMultiPaging) {
    this.dataloading = true;
    this.pageIndex = paging.pageindex || 1;
    this.filter = paging.filter || [];
    this.pageSize = paging.pagesize || 10;
    this.standardService
      .getall(paging)
      .pipe(first())
      .subscribe(
        (tempdata: any) => {
          this.total = tempdata.data.total;
          this.data = tempdata.data.data;
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
      )
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = params;
    // console.log(params)
    this.assignFilterNewValue(filter);
    await this.loadDataFromServer({
      filter: this.filter,
      pageindex: pageIndex,
      pagesize: pageSize,
    });
  }

  deletetag = async (standardid: string) => {
    let answer: unknown;
    try {
      answer = await this.standardService.delete(standardid).pipe(first()).toPromise();
    } catch (e) {
      // The delete request opts out of the interceptor's 400, 403 and 404 notices, so each is said here, once. Any
      // other failure (500, 429, the gateway, no connection) is still the interceptor's.
      const error = e as HttpErrorResponse;
      if (error?.status === 400) {
        this.notification.create('error', 'Error', classDeleteRefusalText(error.error));
      } else if (error?.status === 403) {
        this.notification.create('error', 'Error', "You don't have permission to do that.");
      } else if (error?.status === 404) {
        const said = error.error?.errormessage;
        this.notification.create('error', 'Error', typeof said === 'string' && said.trim() ? said : NOT_FOUND_MESSAGE, { nzKey: NOT_FOUND_TOAST_KEY });
        this.loadDataFromServer({ filter: [...this.filter], pageindex: this.pageIndex, pagesize: this.pageSize });
      } else {
        throw e;
      }
      return;
    }
    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
    // A delete central saved but could not send to the learning server leaves a warning that stays, not the success.
    if (!this.sticky.pushFailed(pushOf(answer))) {
      this.notification.create(
        'success',
        'Success',
        'Standard deleted sucessfully'
      );
    }
  };

  constructor(
    private readonly standardService: StandardService,
    private readonly notification: NzNotificationService,
    private readonly schoolService: SchoolService,
    private readonly sticky: StickyNoticeService,
  ) {}

  ngOnInit(): void {
    this.buildFilter();
  }

  async search() {
    this.visible = false;
    if (this.searchValue.length > 0) {
      await this.loadDataFromServer({
        filter: [
          ...this.filter.filter((x) => x.key !== 'standardname'),
          ...[{ key: 'standardname', value: this.searchValue }],
        ],
        pageindex: this.pageIndex,
        pagesize: this.pageSize,
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter((x) => x.key !== 'standardname'),
        pageindex: this.pageIndex,
        pagesize: this.pageSize,
      });
    }
  }

  reset(): void {
    this.searchValue = '';
    this.search();
  }

  assignFilterNewValue = (filter: Array<{ key: string; value: any; }> = []) => {
    // assign standard
    if (this.searchValue.length > 0) {
      this.filter = this.filter.map(obj => obj.key === 'standardname' ? { ...obj , value: this.searchValue} : obj);
    }
    // assign schoolid
    if (filter.length > 0) {
      this.filter = this.filter.map(obj => {
        const field = filter.length > 0 ? filter.find(x => (x.key === obj.key)) : null;
        return field ? { ...obj , value: field.value} : obj;
      });
    }
  }

  buildFilter = async () => {
    // load all school
    this.filterField.school = await this.schoolService.getall({ pagesize: 200 }).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => {
        return (x.data.data).map((school: any) => ({
          text: school.schoolname,
          value: school.schoolid
        }));
      })
    ).toPromise();
  }
}
