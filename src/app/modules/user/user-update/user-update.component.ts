import { Component, OnInit } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, debounceTime, first, map, switchMap } from 'rxjs/operators';
import { CountryService } from 'src/app/services/country.service';
import { RolePermService } from 'src/app/services/role-permission.service';
import { SchoolService } from 'src/app/services/school.service';
import { StandardService } from 'src/app/services/standard.service';
import { UserService } from 'src/app/services/user.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
    selector: 'app-user-update',
    templateUrl: './user-update.component.html',
    styleUrls: ['./user-update.component.less'],
    standalone: false
})
export class UserUpdateComponent implements OnInit {
  initData = true;
  dataloading = false;
  updateForm!: UntypedFormGroup;
  allChecked = false;
  indeterminate = true;
  lmsuser: any;
  roles: Array<{id: string, text:string, checked: boolean}> = [];
  selectedCountry = true;
  countries$?: Observable<any>;
  schools$?: Observable<any>;

  async submitcreateForm() {
    this.utilservice.checkFormDirty(this.updateForm);
    if (this.updateForm.valid) {
      await this.dts
        .update(
          {
            lmsuserid: this.lmsuser.lmsuserid,
            lmsusername: this.updateForm.getRawValue()['lmsusername'],
            lmsuserpasswordhash: this.updateForm.getRawValue()['lmsuserpasswordhash'],
            lmsuserroles: this.updateForm.getRawValue()['lmsuserroles'],
            countryids: this.updateForm.getRawValue()['countryids'],
            schoolids: this.updateForm.getRawValue()['schoolids'],
          }
        )
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'User updated successfully'
      );
      this.router.navigate(['user/index']);
    }
  }
  constructor(
    private fb: UntypedFormBuilder,
    private dts: UserService,
    private roleService: RolePermService,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
    private route: ActivatedRoute,
    private schoolService: SchoolService,
    private readonly countryService: CountryService,
  ) {}

  ngOnInit(): void {
    this.dataloading = true;
    this.updateForm = this.fb.group({
      lmsusername: [null, [Validators.required]],
      lmsuserpasswordhash: [null],
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
    this.dts.get(lmsuserid)
      .pipe(first())
      .subscribe((tempdata: any) => {
        this.roles = tempdata.data.roles;
        this.lmsuser = tempdata.data.user;
        this.updateForm.get('lmsusername')?.setValue(this.lmsuser.lmsusername);
        const lmsuserroles = < UntypedFormArray> this.updateForm.get('lmsuserroles');
        const selectedroles = this.roles.filter(rl => rl.checked === true);
        selectedroles.forEach(role => {
          lmsuserroles.push(new UntypedFormControl(role.id));
        });

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
      (error) => {
        if(error) {
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
    const chkArray = < UntypedFormArray > this.updateForm.get(key);
    if (checked) {
      chkArray.push(new UntypedFormControl(id));
    } else {
      let idx = chkArray.controls.findIndex((x: { value: any; }) => x.value == id);
      chkArray.removeAt(idx);
    }
  }

  onSelected(countryid: any) {
    if(countryid) this.selectedCountry = false;
    // this.schools$ = this.schoolService
    //   .getAllSchools('', countryid)
    //   .pipe(
    //     catchError(() => of({ results: [] })),
    //     map((res: any) => res.data)
    //   )
    //   .pipe(
    //     map((list: any) => {
    //       return list;
    //     })
    // );
    // this.schools$.subscribe();
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
      if(this.initData) {
        this.updateForm.get('schoolids')?.setValue(this.lmsuser.schools);
        this.initData = false;
      }
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
