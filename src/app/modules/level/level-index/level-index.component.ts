import { Component, inject } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { first } from 'rxjs/operators';
import { IFilter, IPaging } from 'src/app/models/IPaging';
import { LevelService } from 'src/app/services/level.service';
import { organisationOf, withOrganisationFilter } from 'src/app/shared/owner/owner-view';
import { OwnerViewService } from 'src/app/shared/owner/owner-view.service';

@Component({
    selector: 'app-level-index',
    templateUrl: './level-index.component.html',
    styleUrls: ['./level-index.component.less'],
    standalone: false
})
export class LevelIndexComponent {
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
    this.levelService
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

  deletetag = async (levelid: string) => {
    await this.levelService.delete(levelid).pipe(first()).toPromise();
    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize
    })
    this.notification.create("success", 'Success', "Level deleted sucessfully");
  }

  constructor(
    private levelService: LevelService,
    private readonly notification: NzNotificationService,
  ) { }

  async search() {
    this.visible = false;
    if (this.searchValue.length > 0) {
      await this.loadDataFromServer({
        filter: [...this.filter.filter(x => x.key !== "levelname"), ...[{ key: "levelname", value: this.searchValue }]],
        pageindex: this.pageIndex,
        pagesize: this.pageSize
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter(x => x.key !== "levelname"),
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
