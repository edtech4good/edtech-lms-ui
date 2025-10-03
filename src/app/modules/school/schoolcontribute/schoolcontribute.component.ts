import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { first } from 'rxjs/operators';
import { IFilter, IPaging } from 'src/app/models/IPaging';
import { SchoolContributeService } from 'src/app/services/school-contribute.service';

@Component({
  selector: 'app-schoolcontribute',
  templateUrl: './schoolcontribute.component.html',
  styleUrls: ['./schoolcontribute.component.less']
})
export class SchoolcontributeComponent implements OnInit {
  dataloading = false;
  schoolid$ = '';
  total = 1;
  data: Array<any> = [];
  pageSize = 10;
  pageIndex = 1;
  filter: Array<IFilter> = [];
  visible = false;
  filterField = {
    schoolcontribute: []
  }
medium: string|undefined;

  async loadDataFromServer(paging: IPaging) {
    this.dataloading = true;
    this.pageIndex = paging.pageindex || 1;
    this.filter = paging.filter || [];
    this.pageSize = paging.pagesize || 10;
    this.schoolContributerService
      .getall(paging,this.schoolid$)
      .pipe(first())
      .subscribe(
        (temp: any) => {
          this.total = temp.data.total;
          this.data = temp.data.data;
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

  constructor(
    private schoolContributerService: SchoolContributeService,
    private route: ActivatedRoute,
    private notification: NzNotificationService,
    private router: Router
  ) { }

  ngOnInit(): void {
    const schoolid = this.route.snapshot.paramMap.get('schoolid') ?? '';
    if ((schoolid || '').trim().length <= 0) {
      this.notification.create('error', 'error', 'Invalid link');
      this.router.navigate(['school/index']);
      return;
    }
    this.schoolid$ = schoolid;
  }

  async delete(schoolcontributeid: string){
    await this.schoolContributerService.deleteSchoolContributeDashboard(schoolcontributeid)
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
      'SchoolContribute deleted successfully'
    );
  }
}
