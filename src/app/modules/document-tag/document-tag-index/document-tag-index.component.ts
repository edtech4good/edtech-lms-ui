import { Component, OnInit } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { NgxPermissionsService } from 'ngx-permissions';
import { catchError, first } from 'rxjs/operators';
import { IFilter, IPaging } from 'src/app/models/IPaging';
import { AuthService } from 'src/app/services/auth.service';
import { DocumentTagService } from 'src/app/services/document-tag.service';
import { getappLoading } from 'src/app/store/appstate/appstate.selector';

@Component({
  selector: 'app-document-tag-index',
  templateUrl: './document-tag-index.component.html',
  styleUrls: ['./document-tag-index.component.less'],
})
export class DocumentTagIndexComponent {
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
    this.documentTagService
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
            this.dataloading = false;
          }, 400);
        }
      )
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = params;
    await this.loadDataFromServer({
      filter: this.filter,
      pageindex: pageIndex,
      pagesize: pageSize,
    });
  }

  deletetag = async (documenttagid: string) => {
    await this.documentTagService
      .delete(documenttagid)
      .pipe(
        first(),
        catchError(async (error) => {
          this.dataloading = false,
          this.notification.create('error','Server Error',error)
        })
      )
      .toPromise();
    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
    this.notification.create(
      'success',
      'Success',
      'Document tag deleted successfully'
    );
  };

  constructor(
    private documentTagService: DocumentTagService,
    private readonly notification: NzNotificationService,
  ) {}

  async search() {
    this.visible = false;
    if (this.searchValue.length > 0) {
      await this.loadDataFromServer({
        filter: [
          ...this.filter.filter((x) => x.key !== 'documenttagname'),
          ...[
            {
              key: 'documenttagname',
              value: this.searchValue.trim().toLowerCase(),
            },
          ],
        ],
        pageindex: this.pageIndex,
        pagesize: this.pageSize,
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter((x) => x.key !== 'documenttagname'),
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
