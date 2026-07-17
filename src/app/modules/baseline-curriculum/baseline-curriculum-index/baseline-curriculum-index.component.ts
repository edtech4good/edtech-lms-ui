import { Component, OnInit } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { catchError, first } from 'rxjs/operators';
import { IFilter, IPaging } from 'src/app/models/IPaging';
import { BaseCurriculumService } from 'src/app/services/base-curriculum.service';
import saveAs from 'file-saver';

@Component({
    selector: 'app-baseline-curriculum-index',
    templateUrl: './baseline-curriculum-index.component.html',
    styleUrls: ['./baseline-curriculum-index.component.less'],
    standalone: false
})
export class BaselineCurriculumIndexComponent {
  dataloading = false;
  disable = true;
  searchValue = '';
  total = 1;
  data: Array<any> = [];
  pageSize = 10;
  pageIndex = 1;
  filter: Array<IFilter> = [];
  visible = false;
  baselinetype = [
    {name: 'Baseline', value: 1},
    {name: 'Midline', value: 2},
    {name: 'Endline', value: 3}
  ];
  type: any[] = [];
  async loadDataFromServer(paging: IPaging) {
    this.dataloading = true;
    this.pageIndex = paging.pageindex || 1;
    this.filter = paging.filter || [];
    this.pageSize = paging.pagesize || 10;
    // const tempdata: any = await
    this.curriculumService
      .getall()
      .pipe(first())
      .subscribe(
        (tempdata: any) => {
          this.total = tempdata.data.total;
          this.data = tempdata.data;
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
      pagesize: pageSize,
    });
  }

  deletetag = async (curriculumbaselineid: string) => {
    await this.curriculumService.delete(curriculumbaselineid).pipe(first()).toPromise();
    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
    this.notification.create(
      'success',
      'Success',
      'Baseline Curriculum deleted successfully'
    );
  };

  async Activate(curriculumbaselineid: string, curriculumid: string) {
    await this.curriculumService.activate(curriculumbaselineid,curriculumid).pipe(first()).toPromise();
    this.loadDataFromServer({});
    this.notification.create(
      'success',
      'Success',
      'Curriculum Baseline activate successfully'
    );
  }

  async Deactivate(curriculumbaselineid: string) {
    await this.curriculumService.deactivate(curriculumbaselineid).pipe(first()).toPromise();
    this.loadDataFromServer({});
    this.notification.create(
      'success',
      'Success',
      'Baseline Curriculum deactivate successfully'
    );
  }

  constructor(
    private curriculumService: BaseCurriculumService,
    private readonly notification: NzNotificationService
  ) {}
  async search() {
    this.visible = false;
    if (this.searchValue.length > 0) {
      await this.loadDataFromServer({
        filter: [
          ...this.filter.filter((x) => x.key !== 'curriculumname'),
          ...[{ key: 'curriculumname', value: this.searchValue }],
        ],
        pageindex: this.pageIndex,
        pagesize: this.pageSize,
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter((x) => x.key !== 'curriculumname'),
        pageindex: this.pageIndex,
        pagesize: this.pageSize,
      });
    }
  }

  reset(): void {
    this.searchValue = '';
    this.search();
  }
  cloudsync = () => {
    this.dataloading = true;
    this.curriculumService
    .cloudsync()
    .pipe(first())
    .subscribe(async (_res: any) => {
      this.notification.create(
        'success',
        'Success',
        `Content synced to cloud successfully`
      );
    },(error)=>{
      if(error){
        this.dataloading = false;
      }
    },()=>{
      this.dataloading = false;
    });
  }


  Disable(startDate: Date, endDate: Date, status: boolean){
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date();

    if(status){
      this.disable = true;
      return true;
    }

    if(current > start || current >= end){
      this.disable = true;
      return true;
    }else{
      this.disable = false;
      return false;
    }
  }

  DisableActivate(startDate: Date, endDate: Date){
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date();

    if(current > end){
      return true;
    }else{
      return false;
    }
  }

  downloading = false;
  downloadStudentResults(curriculumbaselineid: string) {
    this.downloading = true;
    return this.curriculumService.downloadStudentBaselineResult(curriculumbaselineid)
      .pipe(
        first(),
        catchError((x) => {
          this.downloading = false;
          return x;
        })
      )
      .subscribe((x: any) => {
        saveAs(x as Blob, `students-results.csv`);
        this.downloading = false;
      });
  }

}
