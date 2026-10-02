import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, debounceTime, first, map, switchMap } from 'rxjs/operators';
import { AuthService } from 'src/app/services/auth.service';
import { CountryService } from 'src/app/services/country.service';
import { RolePermService } from 'src/app/services/role-permission.service';
import { SchoolService } from 'src/app/services/school.service';
import { UserService } from 'src/app/services/user.service';
import { confirmDialog } from '../../organisation/confirm-dialog';
import { Organisation } from '../../organisation/organisation.model';
import {
  CHOOSE_ORGANISATION,
  MARKED_ROLES_NOTE,
  NO_ORGANISATION_NOTE,
  OWN_ROLES_CONFIRM,
  SIGN_IN_LOCKED_NOTE,
  STAFF_FIELD_ORDER,
  STAFF_NOT_FOUND,
  StaffErrors,
  StaffField,
  holdsSuperAdmin,
  serverStaffErrors,
} from '../staff-form';

interface RoleChoice {
  id: string;
  text: string;
  checked: boolean;
  /** false: the caller could not give this role (it is kept ticked, and marked *). */
  canadd?: boolean;
}

@Component({
    selector: 'app-user-update',
    templateUrl: './user-update.component.html',
    styleUrls: ['./user-update.component.less'],
    standalone: false
})
export class UserUpdateComponent implements OnInit {
  dataloading = false;
  submitting = false;
  /** The account is not there for this caller: gone, or in another organisation, or a platform account. */
  notFound = false;
  readonly notFoundText = STAFF_NOT_FOUND;
  updateForm!: UntypedFormGroup;
  lmsuser: any;
  roles: RoleChoice[] = [];
  selectedCountry = true;
  countries$?: Observable<any>;
  schools$?: Observable<any>;

  private readonly scope = this.auth.staffScope();
  readonly isPlatform = this.scope.isPlatform;
  organisations: Organisation[] = [];
  organisationsFailed = false;
  readonly noOrganisationNote = NO_ORGANISATION_NOTE;
  readonly markedRolesNote = MARKED_ROLES_NOTE;
  readonly signInLockedNote = SIGN_IN_LOCKED_NOTE;
  errors: StaffErrors = { fields: {} };
  /** The roles ticked when the account was opened, to tell whether the set changed. */
  private initialRoleIds: string[] = [];

  @ViewChild('submitButton', { read: ElementRef }) submitButton?: ElementRef<HTMLButtonElement>;

  /** Does the account hold a role this caller could not give? Then it is wider than the caller. */
  get holdsRoleBeyondCaller(): boolean {
    return this.roles.some((r) => r.canadd === false && r.checked);
  }

  /** The email and password stay as they are when the account is wider than a caller who is not platform staff. */
  get signInLocked(): boolean {
    return !this.isPlatform && this.holdsRoleBeyondCaller;
  }

  get hasMarkedRoles(): boolean {
    return this.roles.some((r) => r.canadd === false);
  }

  get platformAccount(): boolean {
    return holdsSuperAdmin(this.updateForm?.get('lmsuserroles')?.value ?? []);
  }

  get isSelf(): boolean {
    return !!this.lmsuser && this.lmsuser.lmsuserid === this.scope.lmsuserid;
  }

  private rolesChanged(): boolean {
    const now = [...(this.updateForm.get('lmsuserroles')?.value ?? [])].sort();
    const before = [...this.initialRoleIds].sort();
    return now.length !== before.length || now.some((id, i) => id !== before[i]);
  }

  submitcreateForm() {
    if (this.submitting) return;
    const value = this.updateForm.getRawValue();
    const fields: StaffErrors['fields'] = {};
    if (!value.lmsusername) fields.lmsusername = 'Enter the email address.';
    if (this.isPlatform && !this.platformAccount && !value.organisationid) fields.organisationid = CHOOSE_ORGANISATION;
    this.errors = { fields };
    if (Object.keys(fields).length > 0) {
      this.focusFirstError();
      return;
    }
    if (this.isSelf && this.rolesChanged()) {
      confirmDialog(this.modal, {
        nzTitle: OWN_ROLES_CONFIRM,
        nzOkText: 'Continue',
        nzCancelText: 'Cancel',
        nzOnOk: () => this.save(value, true),
      });
      return;
    }
    this.save(value, false);
  }

  private save(value: any, endsOwnSession: boolean) {
    this.submitting = true;
    this.dts
      .update(this.lmsuser.lmsuserid, {
        lmsusername: value.lmsusername,
        lmsuserpasswordhash: value.lmsuserpasswordhash,
        lmsuserroles: value.lmsuserroles,
        countryids: value.countryids,
        schoolids: value.schoolids,
        // Only a platform caller names the organisation (none for a platform account).
        ...(this.isPlatform ? { organisationid: this.platformAccount ? null : value.organisationid } : {}),
      })
      .pipe(first())
      .subscribe({
        next: () => {
          this.submitting = false;
          if (endsOwnSession) {
            // The API ended this person's sessions with the role change: say so once, on the sign-in page.
            this.notification.create('info', 'Your roles changed', 'Sign in again to continue.');
            this.auth.logout();
            return;
          }
          this.notification.create('success', 'Success', 'User updated successfully');
          this.router.navigate(['user/index']);
        },
        error: (error: HttpErrorResponse) => {
          this.submitting = false;
          this.errors = serverStaffErrors(error);
          this.focusFirstError();
        },
      });
  }

  constructor(
    private fb: UntypedFormBuilder,
    private dts: UserService,
    private roleService: RolePermService,
    private router: Router,
    private readonly notification: NzNotificationService,
    private route: ActivatedRoute,
    private schoolService: SchoolService,
    private readonly countryService: CountryService,
    private readonly auth: AuthService,
    private readonly modal: NzModalService
  ) {}

  ngOnInit(): void {
    this.dataloading = true;
    this.updateForm = this.fb.group({
      lmsusername: [null, [Validators.required]],
      lmsuserpasswordhash: [null],
      organisationid: [null],
      lmsuserroles: this.fb.array([]),
      countryids: [[]],
      schoolids: [[]],
    });
    this.setupSearchSchool();

    const lmsuserid = this.route.snapshot.paramMap.get('lmsuserid') ?? '';
    if ((lmsuserid || '').trim().length <= 0) {
      this.notification.create('error', 'error', 'Invalid link');
      this.router.navigate(['user/index']);
      return;
    }
    if (this.isPlatform) {
      this.dts
        .liveOrganisations()
        .pipe(first())
        .subscribe({
          next: (all) => (this.organisations = all),
          error: () => (this.organisationsFailed = true),
        });
    }
    this.dts.get(lmsuserid)
      .pipe(first())
      .subscribe((tempdata: any) => {
        this.roles = tempdata.data.roles;
        this.lmsuser = tempdata.data.user;
        this.updateForm.get('lmsusername')?.setValue(this.lmsuser.lmsusername);
        this.updateForm.get('organisationid')?.setValue(this.lmsuser.organisationid ?? null);
        const lmsuserroles = < UntypedFormArray> this.updateForm.get('lmsuserroles');
        const selectedroles = this.roles.filter(rl => rl.checked === true);
        selectedroles.forEach(role => {
          lmsuserroles.push(new UntypedFormControl(role.id));
        });
        this.initialRoleIds = selectedroles.map((r) => r.id);
        this.updateForm.get('schoolids')?.setValue(this.lmsuser.schools ?? []);
        if (this.signInLocked) {
          this.updateForm.get('lmsusername')?.disable();
          this.updateForm.get('lmsuserpasswordhash')?.disable();
        }

        // load all country
        this.countries$ = this.countryService.getall({ pagesize: 200 }).pipe(
          catchError((x: any) => []),
          first(),
          map((x: any) => {
            this.updateForm.get('countryids')?.setValue(this.lmsuser.countries);
            return x.data.data;
          })
        );
        this.countries$?.subscribe();
      },
      (error: HttpErrorResponse) => {
        this.dataloading = false;
        // An account that is not there for this caller is a state of its own, not an empty form.
        if (error?.status === 404) {
          this.notFound = true;
        }
      },
      () => {
        setTimeout(() => {
          this.dataloading = false;
        }, 400);
      });
  }

  updateChkbxArray(id: any, isChecked: any, key: any) {
    const checked = isChecked.target.checked;
    const chkArray = < UntypedFormArray > this.updateForm.get(key);
    if (checked) {
      chkArray.push(new UntypedFormControl(id));
    } else {
      let idx = chkArray.controls.findIndex((x: { value: any; }) => x.value == id);
      chkArray.removeAt(idx);
    }
    if (key === 'lmsuserroles' && this.platformAccount) {
      // A platform account has no organisation: clear the choice (it is disabled while Super Admin is ticked).
      this.updateForm.get('organisationid')?.setValue(null);
      if (this.errors.fields.organisationid) this.errors = { ...this.errors, fields: { ...this.errors.fields, organisationid: undefined } };
    }
  }

  /** Focus the first field with a message, or the submit button when the message is for the form. */
  private focusFirstError(): void {
    const first = STAFF_FIELD_ORDER.find((k) => this.errors.fields[k]);
    setTimeout(() => this.focusWhenReady(first, 0), 0);
  }

  private focusWhenReady(field: StaffField | undefined, attempt: number): void {
    const target = field
      ? document.getElementById(`staff-${field}`)
      : this.submitButton?.nativeElement;
    if (target && !(target as HTMLButtonElement).disabled) {
      target.focus({ preventScroll: true });
      (field ? target : document.querySelector('.form-error') ?? target).scrollIntoView({ block: 'nearest' });
    } else if (attempt < 20) {
      setTimeout(() => this.focusWhenReady(field, attempt + 1), 25);
    }
  }

  onSelected(countryid: any) {
    if(countryid) this.selectedCountry = false;
    this.onSearchSchool('');
  }

  // search school
  searchSchoolChange$ = new BehaviorSubject({
    schoolname: '',
    countryid: '',
  });
  schoolList: any[] = [];
  isSchoolLoading = false;

  setupSearchSchool() {
    const schoolList$: Observable<string[]> = this.searchSchoolChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getSchoolList));
    schoolList$.subscribe((data) => {
      this.schoolList = data;
      this.isSchoolLoading = false;
    });
  }

  onSearchSchool(value: string): void {
    this.isSchoolLoading = true;
    this.searchSchoolChange$.next({
      schoolname: value,
      countryid: this.updateForm.getRawValue()['countryids']?.[0] ?? '',
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
}
