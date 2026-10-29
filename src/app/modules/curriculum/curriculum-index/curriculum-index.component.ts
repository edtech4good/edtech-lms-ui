import { HttpErrorResponse } from '@angular/common/http';
import { Component, ViewChild, inject } from '@angular/core';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { EmptyError, Subject, lastValueFrom } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { IFilter, IPaging } from 'src/app/models/IPaging';
import { confirmDialog } from 'src/app/modules/organisation/confirm-dialog';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { clearListCaches } from 'src/app/services/list-cache';
import { organisationOf, withOrganisationFilter } from 'src/app/shared/owner/owner-view';
import { OwnerViewService } from 'src/app/shared/owner/owner-view.service';
import { PublishDrawerComponent } from 'src/app/shared/publication/publish-drawer.component';
import { refusalText } from 'src/app/shared/publication/publication-errors';
import { Pill, PublicationOverview, PushOutcome, pillOf, pushMessage, pushToast, refusalOf } from 'src/app/shared/publication/publication.model';

/** What a row knows of its publication state: being read, read, or not readable (shown as a dash). */
export type RowState = { kind: 'loading' } | { kind: 'ready'; overview: PublicationOverview; pill: Pill } | { kind: 'failed' };

@Component({
    selector: 'app-curriculum-index',
    templateUrl: './curriculum-index.component.html',
    styleUrls: ['./curriculum-index.component.less'],
    standalone: false
})
export class CurriculumIndexComponent {
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
  pageSize = 10;
  pageIndex = 1;
  filter: Array<IFilter> = [];
  visible = false;
  async loadDataFromServer(paging: IPaging) {
    this.dataloading = true;
    this.pageIndex = paging.pageindex || 1;
    this.filter = paging.filter || [];
    this.pageSize = paging.pagesize || 10;
    // const tempdata: any = await
    this.curriculumService
      .getall(paging)
      .pipe(first())
      .subscribe(
        (tempdata: any) => {
          this.total = tempdata.data.total;
          this.data = tempdata.data.data;
          void this.readStates(this.data);
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
    //   .toPromise();
    // this.total = tempdata.data.total;
    // this.data = tempdata.data.data;
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = params;
    await this.loadDataFromServer({
      filter: this.filter,
      pageindex: pageIndex,
      pagesize: pageSize,
    });
  }

  // ---- Publication state ---------------------------------------------------------------------
  /** Each row's state, by curriculum id. The list endpoint carries none, so it is read once per row after the rows load. */
  states = new Map<string, RowState>();
  /** Curricula with a publish or retire running: their actions are disabled until it answers. */
  private readonly busy = new Set<string>();
  /** Which load the state reads belong to: a newer load abandons the older one's reads. */
  private statesRun = 0;
  /** Fires when a newer load starts: the read in flight is cancelled, so it neither toasts nor takes the server's time. */
  private readonly readsAbandoned = new Subject<void>();

  @ViewChild(PublishDrawerComponent) private drawer?: PublishDrawerComponent;

  /** Opens the publish drawer for a row. */
  openPublish(row: any): void {
    this.drawer?.show({ curriculumid: row.curriculumid, curriculumname: row.curriculumname });
  }

  /** The drawer published the curriculum: its row reads its state again. */
  async onPublished(curriculumid: string): Promise<void> {
    this.busy.add(curriculumid);
    try {
      await this.refreshState(curriculumid);
    } finally {
      this.busy.delete(curriculumid);
    }
  }

  /** The drawer found the curriculum gone: the list is read again. */
  onMissing(): void {
    this.loadDataFromServer({ filter: [...this.filter], pageindex: this.pageIndex, pagesize: this.pageSize });
  }

  stateOf(curriculumid: string): RowState {
    return this.states.get(curriculumid) ?? { kind: 'loading' };
  }

  isBusy(curriculumid: string): boolean {
    return this.busy.has(curriculumid);
  }

  /**
   * Reads the overview of each row, one after the other. A row whose overview cannot be read shows a dash; the error
   * interceptor has already said why, once. After a failure other than a missing row the reads stop and the rest show a
   * dash too: a service that failed once would fail for the others, and the person would be toasted once per row.
   */
  private async readStates(rows: any[]): Promise<void> {
    const run = ++this.statesRun;
    this.readsAbandoned.next();
    this.states = new Map(rows.map((r) => [r.curriculumid, { kind: 'loading' } as RowState]));
    let stopped = false;
    for (const row of rows) {
      if (run !== this.statesRun) return;
      if (stopped) {
        this.states.set(row.curriculumid, { kind: 'failed' });
        continue;
      }
      try {
        const overview = await lastValueFrom(this.curriculumService.publication(row.curriculumid).pipe(takeUntil(this.readsAbandoned)));
        if (run !== this.statesRun) return;
        this.states.set(row.curriculumid, { kind: 'ready', overview, pill: pillOf(overview) });
      } catch (e) {
        if (e instanceof EmptyError || run !== this.statesRun) return;
        this.states.set(row.curriculumid, { kind: 'failed' });
        if ((e as HttpErrorResponse).status !== 404) stopped = true;
      }
    }
  }

  /** Reads one row's overview again (after a publish or a retire). */
  async refreshState(curriculumid: string): Promise<void> {
    try {
      const overview = await lastValueFrom(this.curriculumService.publication(curriculumid));
      this.states.set(curriculumid, { kind: 'ready', overview, pill: pillOf(overview) });
    } catch {
      this.states.set(curriculumid, { kind: 'failed' });
    }
  }

  confirmRetire(row: any): void {
    confirmDialog(this.modal, {
      nzTitle: `Retire “${row.curriculumname}”?`,
      nzContent: 'Learners lose this curriculum at their next sync. Their progress is kept.',
      nzOkText: 'Retire',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => this.retire(row),
    });
  }

  private async retire(row: any): Promise<void> {
    const id: string = row.curriculumid;
    this.busy.add(id);
    try {
      const answer = await lastValueFrom(this.curriculumService.retire(id));
      // The map keeps the tree, with each curriculum's state, in the session: what it holds is now old.
      clearListCaches();
      const toast = pushToast(answer.push);
      this.notification.create(
        toast.type,
        toast.type === 'error' ? `Retired “${row.curriculumname}”, but the push failed` : 'Retired',
        pushMessage(answer.push) || `“${row.curriculumname}” was retired.`,
        { nzDuration: toast.duration }
      );
      await this.refreshState(id);
    } catch (e) {
      this.retireFailed(row, e as HttpErrorResponse);
    } finally {
      this.busy.delete(id);
    }
  }

  /**
   * The retire call is made with FAILURES_SHOWN_BY_CALLER, so the interceptor said nothing: every status is worded here,
   * in one toast. A curriculum that is gone is dropped from the list.
   */
  private retireFailed(row: any, error: HttpErrorResponse): void {
    const title = `Couldn't retire “${row.curriculumname}”`;
    const refusal = refusalOf(error.status, error.error);
    this.notification.error(title, refusalText(refusal, error));
    if (refusal.kind === 'missing') {
      this.loadDataFromServer({ filter: [...this.filter], pageindex: this.pageIndex, pagesize: this.pageSize });
    }
  }

  deletetag = async (curriculumid: string) => {
    // The answer says how pushing the published set to the learner server went (`push`): a delete withdraws the
    // publication, so the learner server is told. A failed push does not undo the delete.
    const answer: any = await this.curriculumService.delete(curriculumid).pipe(first()).toPromise();
    // The map keeps the tree in the session: a deleted curriculum must not stay on it.
    clearListCaches();
    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
    const push: PushOutcome | undefined = answer?.push;
    const toast = pushToast(push);
    this.notification.create(
      toast.type,
      toast.type === 'error' ? 'Curriculum deleted, but the push failed' : 'Success',
      ['Curriculum deleted.', pushMessage(push)].filter((t) => t !== '').join(' '),
      { nzDuration: toast.duration }
    );
  };

  constructor(
    private curriculumService: CurriculumService,
    private readonly notification: NzNotificationService,
    private readonly modal: NzModalService
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
          `Content synced to cloud sucessfully`
        );
      },(error)=>{
        if(error){
          this.dataloading = false;
        }
      },()=>{
        this.dataloading = false;
      })
  }
}
