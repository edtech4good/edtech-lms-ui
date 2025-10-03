import { Component, OnInit } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { first } from 'rxjs/operators';
import { IFilter, IPaging } from 'src/app/models/IPaging';
import { CountryService } from 'src/app/services/country.service';

@Component({
  selector: 'app-country-index',
  templateUrl: './country-index.component.html',
  styleUrls: ['./country-index.component.less']
})
export class CountryIndexComponent {
  dataloading = false;
  searchValue = '';
  total = 1;
  data: Array<any> = [];
  pageSize = 10;
  pageIndex = 1;
  filter: Array<IFilter> = [];
  visible = false;
  async loadDataFromServer(paging: IPaging) {
    this.dataloading = true;
    this.pageIndex = paging.pageindex || 1;
    this.filter = paging.filter || [];
    this.pageSize = paging.pagesize || 10;
    // const tempdata: any =
    this.countryService
      .getall(paging)
      .pipe(first())
      .subscribe(
        (tempdata: any) => {
          this.total = tempdata.data.total;
          this.data = tempdata.data.data;
        },
        (error) => {
          if(error){
            this.dataloading = false;
          }
        },
        () => {
          setTimeout(() => {
            this.dataloading = false
          }, 400);
        }
      )
    }
    // .toPromise();
    // this.total = tempdata.data.total;
    // this.data = tempdata.data.data;

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = params;
    await this.loadDataFromServer({
      filter: this.filter,
      pageindex: pageIndex,
      pagesize: pageSize,
    });
  }

  deletetag = async (countryid: string) => {
    await this.countryService.delete(countryid).pipe(first()).toPromise();
    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
    this.notification.create(
      'success',
      'Success',
      'Country deleted successfully'
    );
  };

  constructor(
    private readonly countryService: CountryService,
    private readonly notification: NzNotificationService
  ) {}

  async search() {
    this.visible = false;
    if (this.searchValue.length > 0) {
      await this.loadDataFromServer({
        filter: [
          ...this.filter.filter((x) => x.key !== 'countryname'),
          ...[{ key: 'countryname', value: this.searchValue }],
        ],
        pageindex: this.pageIndex,
        pagesize: this.pageSize,
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter((x) => x.key !== 'countryname'),
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
