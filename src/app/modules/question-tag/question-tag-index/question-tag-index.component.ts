import { Component } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { first, catchError } from 'rxjs/operators';
import { IFilter, IPaging } from 'src/app/models/IPaging';
import { QuestionTagService } from 'src/app/services/question-tag.service';
import { error } from 'console';

@Component({
    selector: 'app-question-tag-index',
    templateUrl: './question-tag-index.component.html',
    styleUrls: ['./question-tag-index.component.less'],
    standalone: false
})
export class QuestionTagIndexComponent {
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
    this.questionTagService
      .getall(paging)
      .pipe(
        first(),
        catchError(async (error) =>
          this.dataloading = false
        )
      )
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

  deletetag = async (questiontagid: string) => {
    await this.questionTagService
      .delete(questiontagid)
      .pipe(first())
      .toPromise();
    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
    this.notification.create(
      'success',
      'Success',
      'Question tag deleted sucessfully'
    );
  };

  constructor(
    private questionTagService: QuestionTagService,
    private readonly notification: NzNotificationService
  ) {}

  async search() {
    this.visible = false;
    if (this.searchValue.length > 0) {
      await this.loadDataFromServer({
        filter: [
          ...this.filter.filter((x) => x.key !== 'questiontagname'),
          ...[
            {
              key: 'questiontagname',
              value: this.searchValue.trim().toLowerCase(),
            },
          ],
        ],
        pageindex: this.pageIndex,
        pagesize: this.pageSize,
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter((x) => x.key !== 'questiontagname'),
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
