import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { startOfDay } from 'date-fns';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, debounceTime, first, map, switchMap } from 'rxjs/operators';
import { IPaging } from 'src/app/models/IPaging';
import { BaseCurriculumService } from 'src/app/services/base-curriculum.service';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { SchoolService } from 'src/app/services/school.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-baseline-curriculum-create',
  templateUrl: './baseline-curriculum-create.component.html',
  styleUrls: ['./baseline-curriculum-create.component.less'],
})
export class BaselineCurriculumCreateComponent implements OnInit {
  dataloading = false;
  createForm!: UntypedFormGroup;
  valid = false;
  disable = true;
  curriculums: Array<any> = [];
  baselinetype = [
    {name: 'Baseline', value: 1},
    {name: 'Midline', value: 2},
    {name: 'Endline', value: 3}
  ];
  isSchoolLoading: boolean = false;
  school: any [] = [];
  searchSchoolChange$ = new BehaviorSubject({
    schoolname: '',
  });
  searchFields = {
    curriculumid: '',
  }
  listOfSchoolidValue: string[] = [];
  curriculumid: string = '';

  async submitcreateForm() {
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid && this.validate()) {
      // && this.validate()
      // && this.validate()
      // console.log(
      //   '',
      //   this.createForm.getRawValue()['curriculumid'],
      //   this.createForm.getRawValue()['baselineid']
      // );
      await this.dts
        .create(
          this.createForm.getRawValue()['curriculumid'],
          // this.createForm.getRawValue()['baselineid'],
          this.createForm.getRawValue()['baselinename'],
          this.createForm.getRawValue()['baselinetype'],
          this.createForm.getRawValue()['startdate'],
          this.createForm.getRawValue()['enddate'],
          this.createForm.getRawValue()['schoolid'],
        )
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'Baseline curriculum created successfully'
      );
      this.router.navigate(['baseline-curriculum/index']);
    }
  }
  constructor(
    private fb: UntypedFormBuilder,
    private cts: CurriculumService,
    private dts: BaseCurriculumService,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
    private schoolService: SchoolService,
  ) {}

  async ngOnInit() {
    this.setupSearchSchool();
    this.dataloading = true;
    this.createForm = this.fb.group({
      curriculumid: [null, [Validators.required]],
      // baselineid: [null, [Validators.required]],
      baselinename: [null, [Validators.required]],
      baselinetype: [null, [Validators.required]],
      startdate: [null, [Validators.required]],
      enddate: [null, [Validators.required]],
      schoolid: [null, [Validators.required]]
    });
    let tempPage = new IPaging();
    tempPage.pagesize = 200;
    // const data: any = await
    this.cts.getall(tempPage)
    .subscribe(
      (data: any) => {
        this.curriculums = data.data.data;
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

  validateDate() {
    const startDate = new Date(this.createForm.getRawValue()['startdate']);
    const endDate = new Date(this.createForm.getRawValue()['enddate']);
    const fistDate = new Intl.DateTimeFormat("en-US",{ day: "numeric", year: "numeric", month: "numeric"}).format(startDate);
    const secondDate = new Intl.DateTimeFormat("en-US",{ day: "numeric", year: "numeric", month: "numeric"}).format(endDate);
    if (fistDate === secondDate) {
      this.notification.create(
        'warning',
        'warning',
        'Start Date or End Date should be different'
      );
      return false;
    } else {
      return true;
    }
  }

  validate() {
    if (
      this.createForm.getRawValue()['startdate'] < new Date() ||
      this.createForm.getRawValue()['enddate'] < new Date() ||
      this.createForm.getRawValue()['startdate'].value > this.createForm.getRawValue()['enddate'].value
    ) {
      this.notification.create(
        'warning',
        'warning',
        'Start Date or End Date should be greater than Current Date'
        // `hi ${this.createForm.getRawValue()['startdate']}`
      );
      return false;
    } else {
      return true;
    }
  }

  curriculum(curriculumid: string){
    if(curriculumid){
      this.createForm.get('baselineid')
      ?.setValue(this.curriculumid);
    }
  }

  async SearchSchool(curriculumid: string){
    if(curriculumid){
      this.disable = false;
      this.searchFields.curriculumid = curriculumid;
      this.listOfSchoolidValue = [];
      this.setupSearchSchool();
    }
  }

  onSearchSchool(value: string): void {
    this.isSchoolLoading = true;
    this.searchSchoolChange$.next({
      schoolname: value,
    });
  }

  async setupSearchSchool() {
    const schoolList$: Observable<string[]> = this.searchSchoolChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getSchoolList));
    schoolList$.subscribe((data: any) => {
      this.school = data;
      this.isSchoolLoading = false;
    });
  }

  getSchoolList = (search: {
    schoolname: string;
  }): Observable<any> =>
    this.schoolService
      .getSchoolsCurriculum(this.searchFields.curriculumid)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

  isNotSelected(value: string): boolean {
    return this.listOfSchoolidValue.indexOf(value) === -1;
  }
}
