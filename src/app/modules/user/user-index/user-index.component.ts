import { Component } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { first } from 'rxjs/operators';
import { IFilter, IPaging } from 'src/app/models/IPaging';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-user-index',
  templateUrl: './user-index.component.html',
  styleUrls: ['./user-index.component.less'],
})
export class UserIndexComponent {
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
    this.userService
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
      );
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = params;
    await this.loadDataFromServer({
      filter: this.filter,
      pageindex: pageIndex,
      pagesize: pageSize,
    });
  }

  deletetag = async (userid: string) => {
    await this.userService.delete(userid).pipe(first()).toPromise();
    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
    this.notification.create(
      'success',
      'Success',
      'The user is deleted successfully'
    );
  };

  constructor(
    private readonly userService: UserService,
    private readonly notification: NzNotificationService
  ) {}

  async search() {
    this.visible = false;
    if (this.searchValue.length > 0) {
      await this.loadDataFromServer({
        filter: [
          ...this.filter.filter((x) => x.key !== 'lmsusername'),
          ...[{ key: 'lmsusername', value: this.searchValue }],
        ],
        pageindex: this.pageIndex,
        pagesize: this.pageSize,
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter((x) => x.key !== 'lmsusername'),
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
