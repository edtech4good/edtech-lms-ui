import { Component, HostListener, OnInit, inject } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import * as csv from 'csvtojson';
import { uniq } from 'lodash';
import { NzOptionSelectionChange } from 'ng-zorro-antd/auto-complete';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzUploadChangeParam, NzUploadFile } from 'ng-zorro-antd/upload';
import { BehaviorSubject, EMPTY, Observable, of, Subscription } from 'rxjs';
import { catchError, debounceTime, filter, finalize, first, map, switchMap } from 'rxjs/operators';
import { CONFIRM_OK_SELECTOR, disableConfirmText, disableNotice, focusSoon, insideConfirmOrMenu, noticeOptions, restoreFocus, rowControl, withDisabled } from '../account-disable';
import { canRemove, focusAfterRemove, removeConfirmText, removeFailureText, removedText } from '../account-remove';
import { restoreFocusAfterDrawer } from '../reset-password/drawer-focus';
import { EditLearnerResult, savedNotice } from '../edit-learner/edit-learner';
import { MoveLearnerResult, MoveOption, NO_OTHER_SCHOOL_TOOLTIP, SchoolRow, movedNotice, schoolsToMoveTo } from '../move-learner/move-learner';
import { IFilter } from 'src/app/models/IPaging';
import { StudentImport, StudentImportForEdit } from 'src/app/models/studentimport';
import { CoreService } from 'src/app/services/core.service';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { SchoolService } from 'src/app/services/school.service';
import { StandardService } from 'src/app/services/standard.service';
import { StudentService } from 'src/app/services/student.service';
import { UtilService } from 'src/app/services/util.service';
import { uploadEditedStudentsValidationSchema, uploadStudentsValidationSchema } from 'src/app/services/validator.service';
import saveAs from 'file-saver';
import { CountryService } from 'src/app/services/country.service';
import { CHOOSE_ORGANISATION_NOTICE, ORGANISATION_FILTER_KEY } from 'src/app/shared/owner/owner-view';
import { OwnerViewService } from 'src/app/shared/owner/owner-view.service';

@Component({
    selector: 'app-student-index',
    templateUrl: './student-index.component.html',
    styleUrls: ['./student-index.component.less'],
    standalone: false
})
export class StudentIndexComponent implements OnInit {
  readonly owner = inject(OwnerViewService);
  readonly chooseOrganisationNotice = CHOOSE_ORGANISATION_NOTICE;
  /** The organisation the platform view is narrowed to (null: all). */
  organisationId: string | null = null;
  async onOwnerFilter(organisationid: string | null) {
    this.organisationId = organisationid;
    this.pageIndex = 1;
    await this.loadDataFromServer();
  }

  curriculum$?: Observable<any>;
  school$?: Observable<any>;
  standard$?: Observable<any>;
  uploadForm!: UntypedFormGroup;

  selectStandard: boolean = true;
  showUpload: boolean = false;
  selectedSchool: boolean = true;
  data: Array<any> = [];
  fileList: NzUploadFile[] = [];
  dataLoading: boolean = true;
  currentSearch: string = 'studentfirstname';
  searchData: {
    [key: string]: {
      value: string;
      visible: boolean;
    };
  } = {
    studentfirstname: {
      value: '',
      visible: false,
    },
    schoolname: {
      value: '',
      visible: false,
    },
    standard: {
      value: '',
      visible: false,
    },
    country: {
      value: '',
      visible: false,
    },
    'schooluser.schoolusername': {
      value: '',
      visible: false,
    },
    'curriculum.curriculumname': {
      value: '',
      visible: false,
    },
  };

  total = 1;
  pageSize = 100;
  pageIndex = 1;
  filter: Array<IFilter> = [];

  selectTab = 0;

  searchFields = {
    countryid: '',
    schoolname: '',
    studentid: '',
    schoolExportname: '',
  };
  // search country
  searchCountryChange$ = new BehaviorSubject({
    countryname: 'string',
  });
  countryList: any[] = [];
  isCountryLoading = false;
  // search school
  searchSchoolChange$ = new BehaviorSubject({
    schoolname: 'string',
    countryid: 'string',
  });
  schoolList: any[] = [];
  isSchoolLoading = false;
  // search user
  searchUserChange$ = new BehaviorSubject('');
  userList: any[] = [];
  isUserLoading = false;
  // search school
  searchSchoolExportChange$ = new BehaviorSubject({
    schoolname: 'string',
  });
  schoolExportList: any[] = [];
  isSchoolExportLoading = false;

  constructor(
    private fb: UntypedFormBuilder,
    private studentService: StudentService,
    private utilService: UtilService,
    private readonly notification: NzNotificationService,
    private readonly coreService: CoreService,
    private readonly schoolService: SchoolService,
    private readonly standardService: StandardService,
    private countryService: CountryService,
  ) {}
  ngOnInit() {
    this.school$ = this.schoolService.getall({ pagesize: 200 }).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => x.data.data)
    );
    this.school$.subscribe();
    this.loadMoveSchools();
    this.resetForm();
    this.setupSearchCountry();
    this.setupSearchSchool();
    this.setupSearchUser();
  }
  resetForm = () => {
    this.uploadForm = this.fb.group({
      curriculumid: [null, [Validators.required]],
      schoolid: [null, [Validators.required]],
      standard: [null],
    });
  };
  async search() {
    this.searchData[this.currentSearch].visible = false;
    await this.loadDataFromServer();
  }
  showAddLearnerDrawer = false;
  showAddLearner = () => {
    this.showAddLearnerDrawer = true;
  };
  closeAddLearner = () => {
    this.showAddLearnerDrawer = false;
  };
  /** A learner was added: the list shows them. The drawer stays open to show the password once. */
  onLearnerAdded() {
    void this.loadDataFromServer();
  }
  showuploadStudents = () => {
    this.showUpload = true;
  };
  closeUpload = () => {
    this.showUpload = false;
  };

  sampleFile = () => `${this.coreService.CORE_API()}assets/user-upload.csv`;

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

  async loadDataFromServer(after?: () => unknown) {
    this.dataLoading = true;
    this.studentService
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
        this.dataLoading = false;
        after?.();
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
        const data: Array<StudentImport> = await csv().fromString(file!);
        const validate = this.utilService.validate(
          uploadStudentsValidationSchema,
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
            'Duplicate school user name not allowed'
          );
          return;
        }
        this.studentService
          .uploadStudent({
            students: data,
            curriculumid: this.uploadForm.getRawValue()['curriculumid'],
            schoolid: this.uploadForm.getRawValue()['schoolid'],
            standard: this.uploadForm.getRawValue()['standard'],
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
              'Users uploaded successfully'
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

  /** The schooluserid whose Disable / Enable confirm is open. */
  confirming: string | null = null;
  private readonly changing = new Set<string>();
  isChanging = (row: any) => this.changing.has(row.schooluserid);
  username = (row: any): string => row['schooluser.schoolusername'];
  /** Which of the two the open confirm is for: the Disable / Enable change, or the removal of a never-signed-in learner. */
  confirmKind: 'toggle' | 'remove' = 'toggle';
  confirmText = (row: any) => (this.confirmKind === 'remove' ? removeConfirmText(this.username(row)) : disableConfirmText(this.username(row), !row.isdisabled));
  okText = (row: any) => (this.confirmKind === 'remove' ? 'Remove' : row.isdisabled ? 'Enable' : 'Disable');
  canRemove = canRemove;
  /** The schooluserid whose Actions menu is open. */
  menuOpen: string | null = null;
  onMenuVisible(visible: boolean, row: any) {
    this.menuOpen = visible ? row.schooluserid : this.menuOpen === row.schooluserid ? null : this.menuOpen;
    if (visible) focusSoon('.ant-dropdown [data-menu-action]');
    else if (!this.confirming && this.resetFor === null && this.editFor === null && this.moveFor === null) restoreFocus(row.schooluserid);
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
  /** The schooluserid whose Edit details drawer is open (it closes itself when the row goes). */
  editFor: string | null = null;
  openEdit(row: any) {
    this.editFor = row.schooluserid;
  }
  closeEdit() {
    const id = this.editFor;
    this.editFor = null;
    if (id) restoreFocusAfterDrawer(rowControl(id));
  }
  /**
   * The details were saved: the drawer closes, a toast says what the learning server did, and the page of the list is
   * read again. The list shows the curriculum from a join that picks one of the learner's curricula, which the browser
   * cannot reproduce, so the row is not patched in place; focus returns to the row's Actions button once the page is back.
   */
  onDetailsSaved(event: { result: EditLearnerResult; fallbackName: string }) {
    const id = this.editFor;
    this.editFor = null;
    const notice = savedNotice(event.result, event.fallbackName);
    this.notification.create(notice.type, notice.title, notice.text, noticeOptions(notice));
    this.loadDataFromServer(() => id && restoreFocusAfterDrawer(rowControl(id)));
  }
  // ---- Move to another school --------------------------------------------------------------------------------
  readonly noOtherSchoolTooltip = NO_OTHER_SCHOOL_TOOLTIP;
  /** The caller's schools as the schools list answers them (an organisation's staff, or a platform user acting as one, see only that organisation's). */
  private moveSchools: SchoolRow[] = [];
  moveSchoolsState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  private moveSchoolsRead = 0;
  loadMoveSchools() {
    const read = ++this.moveSchoolsRead;
    this.moveSchoolsState = 'loading';
    this.schoolService.getall({ pagesize: 200 }).subscribe({
      next: (answer: any) => {
        if (read !== this.moveSchoolsRead) return;
        this.moveSchools = (answer?.data?.data ?? []) as SchoolRow[];
        this.moveSchoolsState = 'ready';
        this.moveOptions = this.moveTargets(this.moveRow);
      },
      error: () => {
        if (read === this.moveSchoolsRead) this.moveSchoolsState = 'error';
      },
    });
  }
  /** The schools this learner can move to. */
  moveTargets = (row: any): MoveOption[] => schoolsToMoveTo(this.moveSchools, row);
  /** Disabled only once the schools are known and none other is left: while they load the item stays usable and the drawer waits. */
  noMoveTarget = (row: any): boolean => this.moveSchoolsState === 'ready' && this.moveTargets(row).length === 0;
  /** The row of the Move to another school drawer (kept while the drawer slides away). */
  moveRow: any = null;
  /** The schools offered to the learner of `moveRow`, worked out once per opening and again when the schools arrive. */
  moveOptions: MoveOption[] = [];
  moveFor: string | null = null;
  openMove(row: any) {
    if (this.noMoveTarget(row)) return;
    if (this.moveSchoolsState === 'error') this.loadMoveSchools();
    this.moveRow = row;
    this.moveOptions = this.moveTargets(row);
    this.moveFor = row.schooluserid;
  }
  closeMove() {
    const id = this.moveFor;
    this.moveFor = null;
    if (id) restoreFocusAfterDrawer(rowControl(id));
  }
  /** The learner was moved: the drawer closes, a notice gives central's sentence about the push, and the page of the list is read again. */
  onMoved(result: MoveLearnerResult) {
    const id = this.moveFor;
    this.moveFor = null;
    const notice = movedNotice(result);
    this.notification.create(notice.type, notice.title, notice.text, noticeOptions(notice));
    this.loadDataFromServer(() => id && restoreFocusAfterDrawer(rowControl(id)));
  }
  askToggle(row: any) {
    this.openConfirm(row, 'toggle');
  }
  askRemove(row: any) {
    if (!canRemove(row)) return;
    this.openConfirm(row, 'remove');
  }
  private openConfirm(row: any, kind: 'toggle' | 'remove') {
    if (this.changing.has(row.schooluserid)) return;
    this.confirmKind = kind;
    this.confirming = row.schooluserid;
    focusSoon(CONFIRM_OK_SELECTOR);
  }
  onConfirm(row: any) {
    if (this.confirmKind === 'remove') this.removeLearner(row);
    else this.toggleDisabled(row);
  }
  /**
   * Removes a learner who never signed in. Central asks the learning server first; its own sentence is shown for any
   * refusal, which stays until closed, and the row stays. On success the row leaves and focus moves on.
   */
  removeLearner(row: any) {
    const id: string = row.schooluserid;
    this.confirming = null;
    if (this.changing.has(id) || !canRemove(row)) return;
    this.changing.add(id);
    const username = this.username(row);
    const before = this.data.map((r) => r.schooluserid as string);
    let removed = false;
    this.studentService
      .removeStudent(id)
      .pipe(
        first(),
        finalize(() => {
          this.changing.delete(id);
          if (!removed) restoreFocus(id);
        }),
      )
      .subscribe({
        next: (result) => {
          removed = true;
          this.data = this.data.filter((r) => r.schooluserid !== id);
          this.notification.create('success', 'Success', removedText(result, username));
          void this.loadDataFromServer();
          focusAfterRemove(before, id, 'app-student-index .ant-card-head-title');
        },
        error: (error) => {
          this.notification.create('error', 'Error', removeFailureText(error), { nzDuration: 0 });
        },
      });
  }
  /** The confirm closed without a change (Cancel, Escape, a click outside): focus goes back to the Actions button. */
  closeConfirm(visible: boolean, row: any) {
    if (!visible && this.confirming === row.schooluserid) {
      this.confirming = null;
      restoreFocus(row.schooluserid);
    }
  }
  /** A click outside the open confirm and the Actions menu closes the confirm; the click itself carries on. */
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
  /** Disables or enables a learner; the row changes in place and a toast says what the learning server did. */
  toggleDisabled(row: any) {
    const id: string = row.schooluserid;
    this.confirming = null;
    if (this.changing.has(id)) return;
    this.changing.add(id);
    const disabled = !row.isdisabled;
    const username = this.username(row);
    this.studentService
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
          const notice = disableNotice('learner', username, { disabled: state, push: result?.push });
          this.notification.create(notice.type, notice.title, notice.text, noticeOptions(notice));
        },
        error: () => undefined,
      });
  }

  deletestudent = async (schooluserid: string) => {
    await this.studentService
      .deleteStudent(schooluserid)
      .pipe(first())
      .toPromise();
    await this.loadDataFromServer();
    this.notification.create(
      'success',
      'Success',
      'Student deleted sucessfully'
    );
  };

  onSelected(schoolid: any){
    this.selectedSchool = false;
    this.curriculum$ = this.schoolService.getCurriculums(schoolid).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => {
        return x.data;
      })
    );
    this.curriculum$.subscribe();

    this.standard$ = this.standardService.getSchoolidStandard(schoolid).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) =>
      {
        return x.data
      })
    );
    this.standard$.subscribe();
  }

  onSelectcurriculum() {
    this.selectStandard = false;
  }

  setupSearchCountry() {
    const countryList$: Observable<string[]> = this.searchCountryChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getCountryList));
    countryList$.subscribe((data) => {
      this.countryList = data;
      this.isCountryLoading = false;
    });
  }

  onSearchCountry(value: string): void {
    this.isCountryLoading = true;
    this.searchCountryChange$.next({
      countryname: value
    });
  }

  getCountryList = (search: {
    countryname: string;
  }): Observable<any> =>
    this.countryService
      .getAllCountries(search.countryname)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

  setupSearchSchool() {
    const schoolList$: Observable<string[]> = this.searchSchoolChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getSchoolList));
    schoolList$.subscribe((data) => {
      this.schoolList = data;
      this.isSchoolLoading = false;
    });
    const schoolExportList$: Observable<string[]> = this.searchSchoolExportChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getSchoolExportList));
    schoolExportList$.subscribe((data) => {
      this.schoolExportList = data;
      this.isSchoolExportLoading = false;
    });
  }

  onSearchSchool(value: string): void {
    this.isSchoolLoading = true;
    this.searchSchoolChange$.next({
      schoolname: value,
      countryid: this.searchFields.countryid ?? '',
    });
  }

  onSearchExportSchool(value: string): void {
    this.isSchoolExportLoading = true;
    this.searchSchoolExportChange$.next({
      schoolname: value,
    });
  }

  getSchoolList = (search: {
    schoolname: string;
    countryid: string;
  }): Observable<any> =>
    this.schoolService
      .getAllSchools(search.schoolname, search.countryid)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );
  
  getSchoolExportList = (search: {
    schoolname: string;
  }): Observable<any> =>
    this.schoolService
      .getAllSchools(search.schoolname)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

  setupSearchUser() {
    const userList$: Observable<string[]> = this.searchUserChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getUserList));
    userList$.subscribe((data) => {
      this.userList = data;
      this.isUserLoading = false;
    });
  }

  onSearchUser(value: string): void {
    this.isUserLoading = true;
    this.searchUserChange$.next(value);
  }

  getUserList = (userid: string = ''): Observable<any> =>
    this.studentService
      .getAllUsers(userid, '', '', 'true')
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

  handleDownload(file: NzUploadFile) {
    console.log(file);
  }

  downloading = false;
  downloadStudent() {
    this.cleanBody(this.searchFields);
    if(!this.searchFields.countryid && !this.searchFields.schoolname && !this.searchFields.studentid) {
      this.notification.create(
        'error',
        'Failed',
        'Please select a country or a school or a student before download!'
      );
      return;
    }
    this.downloading = true;
    return this.studentService.downloadStudent(this.searchFields.countryid, this.searchFields.schoolname, this.searchFields.studentid)
      .pipe(
        first(),
        catchError((x) => {
          this.downloading = false;
          // The error interceptor has already said what went wrong; a catchError
          // must return an observable (returning the error threw a second one).
          return EMPTY;
        })
      )
      .subscribe((x: any) => {
        let name = '';
        if(this.searchFields.countryid) name = this.countryList.find(ct => ct.countryid == this.searchFields.countryid)?.countryname;
        if(this.searchFields.schoolname) name = this.searchFields.schoolname;
        if(this.searchFields.studentid) name = this.searchFields.studentid;
        saveAs(x as Blob, `students-${name}.csv`);
        this.downloading = false;
      });
  }

  downloadingExport = false;
  exportStudents() {
    if(this.searchFields.schoolExportname == null) this.searchFields.schoolExportname = '';
    if(!this.searchFields.schoolExportname) {
      this.notification.create(
        'error',
        'Failed',
        'Please select a school before download the export!'
      );
      return;
    }
    this.downloadingExport = true;
    return this.studentService.exportStudents(this.searchFields.schoolExportname)
      .pipe(
        first(),
        catchError((x) => {
          this.downloadingExport = false;
          // The error interceptor has already said what went wrong; a catchError
          // must return an observable (returning the error threw a second one).
          return EMPTY;
        })
      )
      .subscribe((x: any) => {
        const name =  this.searchFields.schoolExportname;
        saveAs(x as Blob, `students-${name}.zip`);
        this.downloadingExport = false;
      });
  }

  handleUpdateStudents = async (info: NzUploadChangeParam) => {
    if (info.type === 'start') {
      try {
        const file = await this.utilService.readFileContent(
          info.file.originFileObj
        );
        const data: Array<StudentImportForEdit> = await csv().fromString(file!);
        const validate = this.utilService.validate(
          uploadEditedStudentsValidationSchema,
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
            'Duplicate school user name not allowed'
          );
          return;
        }
        this.studentService
          .uploadEditedStudent({
            students: data,
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
              'Edited Students uploaded successfully'
            );
            await this.loadDataFromServer();
            location.reload();
            return;
          });
      } catch {
        alert('invalid file');
      }
    }
  };

  cleanBody = (body: any) => {
    for (const key in body) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        if(body[key] == null) body[key] = '';
      }
    }
  }
}
