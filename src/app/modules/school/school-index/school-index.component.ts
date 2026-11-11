import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { catchError, first, map } from 'rxjs/operators';
import { IFilter, IMultiFilter, IMultiPaging, IPaging } from 'src/app/models/IPaging';
import { CountryService } from 'src/app/services/country.service';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { SchoolContributeService } from 'src/app/services/school-contribute.service';
import { SchoolService } from 'src/app/services/school.service';
import { StudentService } from 'src/app/services/student.service';
import { TeacherService } from 'src/app/services/teacher.service';
import { organisationOf, withOrganisationFilter } from 'src/app/shared/owner/owner-view';
import { OwnerViewService } from 'src/app/shared/owner/owner-view.service';
import { asksForSyncContent } from 'src/app/shared/notices/notice-rules';
import { SYNC_REFUSED_NOTICE_KEY, StickyNoticeService, pushOf } from 'src/app/shared/notices/sticky-notice.service';

/** What a refused sync says when central sent no words of its own. */
export const SYNC_REFUSED_MESSAGE = 'The sync was refused.';

@Component({
    selector: 'app-school-index',
    templateUrl: './school-index.component.html',
    styleUrls: ['./school-index.component.less'],
    standalone: false
})
export class SchoolIndexComponent implements OnInit {
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
  filter: Array<IMultiFilter> = [
    { key: 'schoolname', value: ""},
    { key: 'countryid', value: ""},
    { key: 'curriculums', value: ""}
  ];
  visible = false;
  filterField = {
    countries: [],
    curriculums: []
  }
  async loadDataFromServer(paging: IMultiPaging) {
    this.dataloading = true;
    this.pageIndex = paging.pageindex || 1;
    this.filter = paging.filter || [];
    this.pageSize = paging.pagesize || 10;
    this.schoolService
      .getall(paging)
      .pipe(first())
      .subscribe(
        (tempdata: any) => {
          this.data = tempdata.data.data;
          this.total = tempdata.data.total;
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
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = params;
    // console.log(params);
    this.assignFilterNewValue(filter);
    await this.loadDataFromServer({
      filter: this.filter,
      pageindex: pageIndex,
      pagesize: pageSize,
    });
  }

  /** The body of the sync notice that carries the link to the Curriculum list. */
  @ViewChild('syncRefusedWithLink', { static: true }) syncRefusedWithLink!: TemplateRef<any>;

  deletetag = async (schoolid: string) => {
    const answer = await this.schoolService.delete(schoolid).pipe(first()).toPromise();
    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
    await this.schoolContributeService.deleteSchoolContribute(schoolid).pipe(first()).toPromise();
    // A delete central saved but could not send to the learning server leaves a warning that stays, not the success.
    if (!this.sticky.pushFailed(pushOf(answer))) {
      this.notification.create(
        'success',
        'Success',
        'School deleted sucessfully'
      );
    }
  };

  constructor(
    private readonly schoolService: SchoolService,
    private readonly notification: NzNotificationService,
    private readonly studentService: StudentService,
    private readonly teacherService: TeacherService,
    private readonly countryService: CountryService,
    private readonly curriculumService: CurriculumService,
    private readonly schoolContributeService: SchoolContributeService,
    private readonly sticky: StickyNoticeService
  ) {}

  ngOnInit(): void {
    this.buildFilter();
  }

  async search() {
    this.visible = false;
    if (this.searchValue.length > 0) {
      await this.loadDataFromServer({
        filter: [
          ...this.filter.filter((x) => x.key !== 'schoolname'),
          ...[{ key: 'schoolname', value: this.searchValue }],
        ],
        pageindex: this.pageIndex,
        pagesize: this.pageSize,
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter((x) => x.key !== 'schoolname'),
        pageindex: this.pageIndex,
        pagesize: this.pageSize,
      });
    }
  }

  exportStudents = (schoolname: string) =>
    this.studentService
      .exportStudent(schoolname)
      .pipe(first())
      .subscribe((res: any) => {
        let url = window.URL.createObjectURL(res);
        let a = document.createElement('a');
        document.body.appendChild(a);
        a.setAttribute('style', 'display: none');
        a.href = url;
        a.download = `students-${schoolname}.zip`;
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      });

  synccloudStudents = (schoolname: string) =>
    this.studentService
      .synccloudStudent(schoolname)
      .pipe(first())
      .subscribe({
        next: async (_res: any) => {
          this.notification.create(
            'success',
            'Success',
            `${schoolname} students synced sucessfully`
          );
        },
        error: (error: HttpErrorResponse) => this.syncRefused(error),
      });

  /** Sends the school's teachers to the learning server. A 409 is shown here; any other refusal (such as "There are no teachers to sync.") is the error interceptor's notice. */
  synccloudTeachers = (schoolname: string) =>
    this.teacherService
      .synccloudTeacher(schoolname)
      .pipe(first())
      .subscribe({
        next: async (_res: any) => {
          this.notification.create(
            'success',
            'Success',
            `${schoolname} teachers synced successfully`
          );
        },
        error: (error: HttpErrorResponse) => this.syncRefused(error),
      });

  /**
   * Central answers a sync it cannot send with a 409 and says what to do first (the learning server lacks the school, a class
   * or a curriculum). Shown as it is, and kept until closed or the route changes, because the person has to act on it; it is
   * one notice however often the sync is pressed. When the next step is Sync Content it carries a link to the Curriculum list,
   * where that button is. The error interceptor says nothing for a 409, so this is the only notice; every other refusal is
   * the interceptor's, as before.
   */
  private syncRefused(error: HttpErrorResponse): void {
    if (error?.status !== 409) return;
    const said = error.error?.errormessage;
    const message = typeof said === 'string' && said.trim() ? said : SYNC_REFUSED_MESSAGE;
    if (asksForSyncContent(message)) {
      this.sticky.show('error', 'Error', this.syncRefusedWithLink, SYNC_REFUSED_NOTICE_KEY, { message });
    } else {
      this.sticky.show('error', 'Error', message, SYNC_REFUSED_NOTICE_KEY);
    }
  }

  reset(): void {
    this.searchValue = '';
    this.search();
  }

  assignFilterNewValue = (filter: Array<{ key: string; value: any; }> = []) => {
    // assign schoolname
    if (this.searchValue.length > 0) {
      this.filter = this.filter.map(obj => obj.key === 'schoolname' ? { ...obj , value: this.searchValue} : obj);
    }
    // assign countryname
    if (filter.length > 0) {
      this.filter = this.filter.map(obj => {
        const field = filter.length > 0 ? filter.find(x => (x.key === obj.key)) : null;
        return field ? { ...obj , value: field.value} : obj;
      });
    }
  }

  buildFilter = async () => {
    // load all country
    this.filterField.countries = await this.countryService.getall({ pagesize: 200 }).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => {
        return (x.data.data).map((country: any) => ({
          text: country.countryname,
          value: country.countryid
        }));
      })
    ).toPromise();

    // all curriculums
    this.filterField.curriculums = await this.curriculumService.getall({ pagesize: 200 }).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => {
        return (x.data.data).map((curriculum: any) => ({
          text: curriculum.curriculumname,
          value: curriculum.curriculumid
        }));
      })
    ).toPromise();
  }
}
