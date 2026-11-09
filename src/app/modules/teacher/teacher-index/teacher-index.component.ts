import { Component, HostListener, OnInit, inject } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import * as csv from 'csvtojson';
import { uniq } from 'lodash';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzUploadChangeParam, NzUploadFile } from 'ng-zorro-antd/upload';
import { Observable, of } from 'rxjs';
import { catchError, finalize, first, map } from 'rxjs/operators';
import { CONFIRM_OK_SELECTOR, disableConfirmText, disableNotice, focusSoon, insideConfirmOrMenu, restoreFocus, rowControl, withDisabled } from '../../student/account-disable';
import { restoreFocusAfterDrawer } from '../../student/reset-password/drawer-focus';
import { IFilter } from 'src/app/models/IPaging';
import { TeacherImport } from 'src/app/models/teacherimport';
import { CoreService } from 'src/app/services/core.service';
import { SchoolService } from 'src/app/services/school.service';
import { TeacherService } from 'src/app/services/teacher.service';
import { UtilService } from 'src/app/services/util.service';
import { uploadTeachersValidationSchema } from 'src/app/services/validator.service';
import { CHOOSE_ORGANISATION_NOTICE, ORGANISATION_FILTER_KEY } from 'src/app/shared/owner/owner-view';
import { OwnerViewService } from 'src/app/shared/owner/owner-view.service';

@Component({
    selector: 'app-teacher-index',
    templateUrl: './teacher-index.component.html',
    styleUrls: ['./teacher-index.component.less'],
    standalone: false
})
export class TeacherIndexComponent implements OnInit {
  readonly owner = inject(OwnerViewService);
  readonly chooseOrganisationNotice = CHOOSE_ORGANISATION_NOTICE;
  /** The organisation the platform view is narrowed to (null: all). */
  organisationId: string | null = null;
  async onOwnerFilter(organisationid: string | null) {
    this.organisationId = organisationid;
    this.pageIndex = 1;
    await this.loadDataFromServer();
  }

  school$?: Observable<any>;
  uploadForm!: UntypedFormGroup;

  showUpload: boolean = false;
  data: Array<any> = [];
  fileList: NzUploadFile[] = [];
  dataLoading: boolean = true;
  currentSearch: string = 'schoolname';
  searchData: {
    [key: string]: {
      value: string;
      visible: boolean;
    };
  } = {
    schoolname: {
      value: '',
      visible: false,
    },
    schoolusername: {
      value: '',
      visible: false,
    },
  };

  total = 1;
  pageSize = 100;
  pageIndex = 1;
  filter: Array<IFilter> = [];
  constructor(
    private fb: UntypedFormBuilder,
    private teacherService: TeacherService,
    private utilService: UtilService,
    private readonly notification: NzNotificationService,
    private readonly coreService: CoreService,
    private readonly schoolService: SchoolService
  ) {}
  ngOnInit() {
    this.school$ = this.schoolService.getall({ pagesize: 200 }).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => x.data.data)
    );
    this.school$.subscribe();

    this.resetForm();
  }
  resetForm = () => {
    this.uploadForm = this.fb.group({
      schoolname: [null, [Validators.required]],
    });
  };
  async search() {
    this.searchData[this.currentSearch].visible = false;
    await this.loadDataFromServer();
  }
  showAddTeacherDrawer = false;
  showAddTeacher = () => {
    this.showAddTeacherDrawer = true;
  };
  closeAddTeacher = () => {
    this.showAddTeacherDrawer = false;
  };
  /** A teacher was added: the list shows them. The drawer stays open to show the password once. */
  onTeacherAdded() {
    void this.loadDataFromServer();
  }
  showuploadTeachers = () => {
    this.showUpload = true;
  };
  closeUpload = () => {
    this.showUpload = false;
  };

  sampleFile = () => `${this.coreService.CORE_API()}assets/teacher-upload.csv`;

  searchVisiblity = (event: boolean, column: string) => {
    if (event) {
      this.currentSearch = column;
    } else {
      this.currentSearch = '';
    }
    this.searchData[column].visible = event;
  };

  reset = async () => {
    this.searchData[this.currentSearch].value = '';
    this.searchData[this.currentSearch].visible = false;
    await this.loadDataFromServer();
  };

  async loadDataFromServer() {
    this.dataLoading = true;
    this.teacherService
      .getall({
        pagesize: this.pageSize,
        pageindex: this.pageIndex,
        filter: Object.entries(this.searchData)
          .filter(
            (
              x: [
                string,
                {
                  value: string;
                  visible: boolean;
                }
              ]
            ) => x[1].value.trim().length > 0
          )
          .map(
            (
              x: [
                string,
                {
                  value: string;
                  visible: boolean;
                }
              ]
            ) => ({ key: x[0], value: x[1].value })
          )
          .concat(this.organisationId ? [{ key: ORGANISATION_FILTER_KEY, value: this.organisationId }] : []),
      })
      .pipe(
        first(),
        catchError((x) => {
          this.dataLoading = false;
          return x;
        })
      )
      .subscribe((x: any) => {
        this.total = x.data.total;
        this.data = x.data.data;
      },
      (error) => {
        if(error) {
          this.dataLoading = false;
        }
      },
      () => {
        setTimeout(() => {
          this.dataLoading = false;
        }, 400);
      });
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = params;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
    await this.loadDataFromServer();
  }

  handleChange = async (info: NzUploadChangeParam) => {
    if (info.type === 'start') {
      this.utilService.checkFormDirty(this.uploadForm);
      if (!this.uploadForm.valid) {
        this.fileList = [];
        return;
      }
      try {
        const file = await this.utilService.readFileContent(
          info.file.originFileObj
        );
        const data: Array<TeacherImport> = await csv().fromString(file!);
        const validate = this.utilService.validate(
          uploadTeachersValidationSchema,
          data,
          {
            abortEarly: false,
          }
        );
        if (validate) {
          this.notification.create('error', 'Error', validate);
          return;
        }
        if (uniq(data.map((x) => x.schoolusername)).length != data.length) {
          this.notification.create(
            'error',
            'Error',
            'Duplicate teacher name not allowed'
          );
          return;
        }
        this.teacherService
          .uploadTeacher({
            teachers: data,
            schoolname: this.uploadForm.getRawValue()['schoolname'],
          })
          .pipe(
            first(),
            catchError(async () => {
              this.resetForm();
              this.closeUpload();
              return null;
            })
          )
          .subscribe(async (x) => {
            this.fileList = [];
            if (!x) {
              return;
            }
            this.notification.create(
              'success',
              'Success',
              'Teachers uploaded successfully'
            );
            this.resetForm();
            this.closeUpload();
            await this.loadDataFromServer();
            return;
          });
      } catch {
        alert('invalid file');
      }
    }
  };

  /** The schooluserid whose Manage menu is open. */
  menuOpen: string | null = null;
  onMenuVisible(visible: boolean, row: any) {
    this.menuOpen = visible ? row.schooluserid : this.menuOpen === row.schooluserid ? null : this.menuOpen;
    if (visible) focusSoon('.ant-dropdown [data-menu-action]');
    else if (!this.confirming && this.resetFor === null) restoreFocus(row.schooluserid);
  }
  /** The schooluserid whose Reset password drawer is open, and its row (kept while the drawer slides away). */
  resetFor: string | null = null;
  resetRow: any = null;
  openReset(row: any) {
    this.resetRow = row;
    this.resetFor = row.schooluserid;
  }
  closeReset() {
    const id = this.resetFor;
    this.resetFor = null;
    if (id) restoreFocusAfterDrawer(rowControl(id));
  }
  private readonly changing = new Set<string>();
  isChanging = (row: any) => this.changing.has(row.schooluserid);
  /** The schooluserid whose Disable / Enable or Delete confirm is open, and which of the two it is. */
  confirming: string | null = null;
  confirmKind: 'toggle' | 'delete' = 'toggle';
  confirmTitle = (row: any) => (this.confirmKind === 'delete' ? 'Sure to delete?' : disableConfirmText(row.schoolusername, !row.isdisabled));
  okText = (row: any) => (this.confirmKind === 'delete' ? null : row.isdisabled ? 'Enable' : 'Disable');
  askToggle(row: any) {
    this.openConfirm(row, 'toggle');
  }
  askDelete(row: any) {
    this.openConfirm(row, 'delete');
  }
  private openConfirm(row: any, kind: 'toggle' | 'delete') {
    if (this.changing.has(row.schooluserid)) return;
    this.confirmKind = kind;
    this.confirming = row.schooluserid;
    focusSoon(CONFIRM_OK_SELECTOR);
  }
  onConfirm(row: any) {
    if (this.confirmKind === 'delete') void this.deleteTeacher(row.schooluserid);
    else this.toggleDisabled(row);
  }
  /** The confirm closed without a change (Cancel, Escape, a click outside): focus goes back to the Manage button. */
  closeConfirm(visible: boolean, row: any) {
    if (!visible && this.confirming === row.schooluserid) {
      this.confirming = null;
      restoreFocus(row.schooluserid);
    }
  }
  /** A click outside the open confirm and the Manage menu closes the confirm; the click itself carries on. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const id = this.confirming;
    if (!id || insideConfirmOrMenu(event.target)) return;
    this.confirming = null;
    restoreFocus(id);
  }
  @HostListener('document:keydown.escape')
  onEscape() {
    const id = this.confirming;
    if (!id) return;
    this.confirming = null;
    restoreFocus(id);
  }
  /** Disables or enables a teacher; the row changes in place and a toast says what the learning server did. */
  toggleDisabled(row: any) {
    const id: string = row.schooluserid;
    this.confirming = null;
    if (this.changing.has(id)) return;
    this.changing.add(id);
    const disabled = !row.isdisabled;
    this.teacherService
      .setDisabled(id, disabled)
      .pipe(
        first(),
        finalize(() => {
          this.changing.delete(id);
          restoreFocus(id);
        }),
      )
      .subscribe({
        next: (result) => {
          const state = typeof result?.disabled === 'boolean' ? result.disabled : disabled;
          this.data = withDisabled(this.data, id, state);
          const notice = disableNotice('teacher', row.schoolusername, { disabled: state, push: result?.push });
          this.notification.create(notice.type, notice.title, notice.text);
        },
        error: () => undefined,
      });
  }

  /** After a delete the row is gone: focus goes to the next row's Manage button, else the previous row's, else the list heading. */
  private focusAfterDelete(before: string[], deleted: string) {
    const at = before.indexOf(deleted);
    const candidates = [...before.slice(at + 1), ...before.slice(0, Math.max(at, 0)).reverse()];
    let done = false;
    [100, 300, 700, 1200].forEach((delay, i, all) => {
      setTimeout(() => {
        // The list is read again after the delete; wait until the deleted row is gone.
        if (done || document.querySelector(rowControl(deleted))) return;
        const active = document.activeElement as HTMLElement | null;
        if (active && active !== document.body && active.isConnected) return; // the user has moved on
        const control = candidates.map((id) => document.querySelector(rowControl(id)) as HTMLElement | null).find((el) => !!el);
        const heading = document.querySelector('app-teacher-index .ant-card-head-title') as HTMLElement | null;
        if (control) control.focus();
        else if (i === all.length - 1 && heading) {
          heading.setAttribute('tabindex', '-1');
          heading.focus();
        } else return;
        done = true;
      }, delay);
    });
  }

  deleteTeacher = async (schooluserid: string) => {
    this.confirming = null;
    if (this.changing.has(schooluserid)) return;
    this.changing.add(schooluserid);
    const before = this.data.map((r) => r.schooluserid as string);
    try {
      await this.teacherService
        .deleteTeacher(schooluserid)
        .pipe(first())
        .toPromise();
      await this.loadDataFromServer();
      this.focusAfterDelete(before, schooluserid);
      this.notification.create(
        'success',
        'Success',
        'Teacher deleted sucessfully'
      );
    } finally {
      this.changing.delete(schooluserid);
      restoreFocus(schooluserid);
    }
  };
}
