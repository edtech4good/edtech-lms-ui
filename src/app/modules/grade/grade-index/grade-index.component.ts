import { Component } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { first } from 'rxjs/operators';
import { IFilter, IPaging } from 'src/app/models/IPaging';
import { GradeService } from 'src/app/services/grade.service';

@Component({
    selector: 'app-grade-index',
    templateUrl: './grade-index.component.html',
    styleUrls: ['./grade-index.component.less'],
    standalone: false
})
export class GradeIndexComponent {
  dataloading = false;
  searchValue = '';
  total = 1;
  data: Array<any> = [];
  pageSize = 100;
  pageIndex = 1;
  filter: Array<IFilter> = [];
  visible = false;
  async loadDataFromServer(paging: IPaging) {
    this.dataloading = true;
    this.pageIndex = paging.pageindex || 1;
    this.filter = paging.filter || [];
    this.pageSize = paging.pagesize || 100;
    // const tempdata: any = await
    this.gradeService
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
    // .toPromise();

  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = params;
    await this.loadDataFromServer({
      filter: this.filter,
      pageindex: pageIndex,
      pagesize: pageSize
    });
  }

  deletetag = async (gradeid: string) => {
    await this.gradeService.delete(gradeid).pipe(first()).toPromise();
    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize
    })
    this.notification.create("success", 'Success', "Grade deleted sucessfully");
  }

  constructor(
    private gradeService: GradeService,
    private readonly notification: NzNotificationService,
  ) { }

  async search() {
    this.visible = false;
    if (this.searchValue.length > 0) {
      await this.loadDataFromServer({
        filter: [...this.filter.filter(x => x.key !== "gradename"), ...[{ key: "gradename", value: this.searchValue }]],
        pageindex: this.pageIndex,
        pagesize: this.pageSize
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter(x => x.key !== "gradename"),
        pageindex: this.pageIndex,
        pagesize: this.pageSize
      });
    }

  }

  reset(): void {
    this.searchValue = '';
    this.search();
  }


}
