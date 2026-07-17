import { Component, OnDestroy, OnInit } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { Observable, of } from 'rxjs';
import { catchError, first, map } from 'rxjs/operators';
import { IFilter, IMultiFilter, IMultiPaging, IPaging } from 'src/app/models/IPaging';
import { ReportService } from 'src/app/services/report.service';
import { StandardService } from 'src/app/services/standard.service';

@Component({
    selector: 'app-sync-record',
    templateUrl: './sync-record.component.html',
    styleUrls: ['./sync-record.component.less'],
    standalone: false
})
export class SyncRecordComponent {
  dataloading = false;
  searchValue = '';
  total = 1;
  data: Array<any> = [];
  syncrecord$?: Observable<any>;
  pageSize = 10;
  pageIndex = 1;
  filter: Array<IMultiFilter> = [];
  visible = false;
  async loadDataFromServer(paging: IMultiPaging) {
    this.dataloading = true;
    this.pageIndex = paging.pageindex || 1;
    this.filter = paging.filter || [];
    this.pageSize = paging.pagesize || 10;
    this.syncrecord$ = this.reportService.getSyncRecords(paging).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => {
        this.data = x.data.data;
        this.total = x.data.total;
        setTimeout(() => {
          this.dataloading = false;
        }, 400);
        return x.data.data;
      })
    );
    this.syncrecord$.subscribe();
    // this.total = tempdata.data.total;
    // this.data = tempdata.data;
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = params;
    await this.loadDataFromServer({
      filter: this.filter,
      pageindex: pageIndex,
      pagesize: pageSize,
    });
  }

  constructor(
    private readonly standardService: StandardService,
    private readonly notification: NzNotificationService,
    private reportService: ReportService
  ) {}

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
}
