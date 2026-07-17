import { Component, OnInit } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
    selector: 'app-user-create',
    templateUrl: './user-create.component.html',
    styleUrls: ['./user-create.component.less'],
    standalone: false
})
export class UserCreateComponent implements OnInit {
  dataloading = false;
  createForm!: UntypedFormGroup;
  allChecked = false;
  indeterminate = true;
  // roles$: Observable<any>;
  roles: Array<{id: string, text:string, checked: boolean}> = [];
  selectedCountry = true;
  countries$?: Observable<any>;
  schools$?: Observable<any>;

  async submitcreateForm() {
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid) {
      await this.dts
        .create(
          this.createForm.getRawValue()['lmsusername'],
          this.createForm.getRawValue()['lmsuserpasswordhash'],
          this.createForm.getRawValue()['lmsuserroles'],
          this.createForm.getRawValue()['countryids'],
          this.createForm.getRawValue()['schoolids'],
        )
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'User created sucessfully'
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
    private schoolService: SchoolService,
    private readonly countryService: CountryService,
    private utilservice: UtilService
  ) {}

  ngOnInit(): void {
    this.dataloading = true;
    this.createForm = this.fb.group({
      lmsusername: [null, [Validators.required]],
      lmsuserpasswordhash: [null, [Validators.required]],
      countryids: [[]],
      schoolids: [[]],
      lmsuserroles: this.fb.array([]),
    });

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
