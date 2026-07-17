import { Component, OnInit } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { first } from 'rxjs/operators';
import { IFilter, IPaging } from 'src/app/models/IPaging';
import { RolePermService } from 'src/app/services/role-permission.service';
import { Router } from '@angular/router';
import { IMultiFilter, IMultiPaging } from '../../../models/IPaging';
import { x } from 'joi';
import { error } from 'console';
import { throwError } from 'rxjs';

@Component({
    selector: 'app-role-index',
    templateUrl: './role-index.component.html',
    styleUrls: ['./role-index.component.less'],
    standalone: false
})
export class RoleIndexComponent {
  dataLoading = false;
  searchValue = '';
  total = 1;
  data: Array<any> = [];
  pageSize = 10;
  pageIndex = 1;
  filter: Array<IMultiFilter> = [];
  visible = false;
  async loadDataFromServer(paging: IMultiPaging) {
    this.dataLoading = true;
    this.pageIndex = paging.pageindex || 1;
    this.filter = paging.filter || [];
    this.pageSize = paging.pagesize || 10;
    this.rolepermService
      .getall(paging)
      .pipe(first())
      .subscribe(
      (x:any) => {
        this.total = x.data.total;
        this.data = x.data.data;
      },
      error =>{
        this.notification.create(
          'error',
          'Error',
          error
        )
        this.dataLoading = false;
      },
      ()=>{
        setTimeout(() => {
          this.dataLoading = false;
        }, 400);
      })
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = params;
    await this.loadDataFromServer({
      filter: this.filter,
      pageindex: pageIndex,
      pagesize: pageSize,
    });
  }

  deletetag = async (roleid: string) => {
    await this.rolepermService.delete(roleid).pipe(first()).toPromise();
    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
    this.notification.create(
      'success',
      'Success',
      'Role deleted successfully'
    );
  };

  constructor(
    private readonly rolepermService: RolePermService,
    private readonly notification: NzNotificationService
  ) {}

  async search() {
    this.visible = false;
    if (this.searchValue.length > 0) {
      console.log(this.searchValue)
      await this.loadDataFromServer({
        filter: [
          ...this.filter.filter((x) => x.key !== 'rolename'),
          ...[{ key: 'rolename', value: this.searchValue }],
        ],
        pageindex: this.pageIndex,
        pagesize: this.pageSize,
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter((x) => x.key !== 'rolename'),
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
