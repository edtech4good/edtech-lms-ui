import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, debounceTime, first, map, switchMap } from 'rxjs/operators';
import { CountryService } from 'src/app/services/country.service';
import { AuthService } from 'src/app/services/auth.service';
import { RolePermService } from 'src/app/services/role-permission.service';
import { SchoolService } from 'src/app/services/school.service';
import { UserService } from 'src/app/services/user.service';
import { Organisation } from '../../organisation/organisation.model';
import {
  CHOOSE_ORGANISATION,
  NO_ORGANISATION_NOTE,
  STAFF_FIELD_ORDER,
  StaffErrors,
  StaffField,
  holdsSuperAdmin,
  serverStaffErrors,
} from '../staff-form';

@Component({
    selector: 'app-user-create',
    templateUrl: './user-create.component.html',
    styleUrls: ['./user-create.component.less'],
    standalone: false
})
export class UserCreateComponent implements OnInit {
  dataloading = false;
  submitting = false;
  createForm!: UntypedFormGroup;
  roles: Array<{id: string, text:string, checked: boolean}> = [];
  selectedCountry = true;
  countries$?: Observable<any>;
  schools$?: Observable<any>;

  /** A platform caller chooses the organisation; anyone else creates inside their own and sends nothing. */
  readonly isPlatform = this.auth.staffScope().isPlatform;
  organisations: Organisation[] = [];
  organisationsFailed = false;
  readonly noOrganisationNote = NO_ORGANISATION_NOTE;
  /** The message beside each field, and one for the form, from the browser's checks and the API's answer. */
  errors: StaffErrors = { fields: {} };

  @ViewChild('submitButton', { read: ElementRef }) submitButton?: ElementRef<HTMLButtonElement>;

  /** Is Super Admin ticked? Then the account is a platform account, and has no organisation. */
  get platformAccount(): boolean {
    return holdsSuperAdmin(this.createForm?.get('lmsuserroles')?.value ?? []);
  }

  async submitcreateForm() {
    if (this.submitting) return;
    const value = this.createForm.getRawValue();
    const fields: StaffErrors['fields'] = {};
    if (!value.lmsusername) fields.lmsusername = 'Enter the email address.';
    if (!value.lmsuserpasswordhash) fields.lmsuserpasswordhash = 'Enter a password.';
    if (!(value.lmsuserroles ?? []).length) fields.lmsuserroles = 'Choose at least one role.';
    if (this.isPlatform && !this.platformAccount && !value.organisationid) fields.organisationid = CHOOSE_ORGANISATION;
    this.errors = { fields };
    if (Object.keys(fields).length > 0) {
      this.focusFirstError();
      return;
    }
    this.submitting = true;
    this.dts
      .create({
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
          this.notification.create('success', 'Success', 'User created sucessfully');
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
    private schoolService: SchoolService,
    private readonly countryService: CountryService,
    private readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    this.dataloading = true;
    this.createForm = this.fb.group({
      lmsusername: [null, [Validators.required]],
      lmsuserpasswordhash: [null, [Validators.required]],
      organisationid: [null],
      countryids: [[]],
      schoolids: [[]],
      lmsuserroles: this.fb.array([]),
    });

    if (this.isPlatform) {
      this.dts
        .liveOrganisations()
        .pipe(first())
        .subscribe({
          next: (all) => (this.organisations = all),
          error: () => (this.organisationsFailed = true),
        });
    }

    // load all country
    this.countries$ = this.countryService.getall({ pagesize: 200 }).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => {
        return x.data.data;
      })
    );
    this.countries$.subscribe();
    this.setupSearchSchool();

    this.roleService.getallRoles()
      .pipe(first())
      .subscribe((tempdata: any) => {
        this.roles = tempdata.data;
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
      });
  }

  updateChkbxArray(id: any, isChecked: any, key: any) {
    const checked = isChecked.target.checked;
    const chkArray = < UntypedFormArray > this.createForm.get(key);
    if (checked) {
      chkArray.push(new UntypedFormControl(id));
    } else {
      let idx = chkArray.controls.findIndex((x: { value: any; }) => x.value == id);
      chkArray.removeAt(idx);
    }
    if (key === 'lmsuserroles' && this.platformAccount) {
      // A platform account has no organisation: clear the choice (it is disabled while Super Admin is ticked).
      this.createForm.get('organisationid')?.setValue(null);
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
      countryid: this.createForm.getRawValue()['countryids']?.[0] ?? '',
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
