import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  selector: 'app-baseline-curriculum-update',
  templateUrl: './baseline-curriculum-update.component.html',
  styleUrls: ['./baseline-curriculum-update.component.less']
})
export class BaselineCurriculumUpdateComponent implements OnInit {
  editForm!: FormGroup;
  baslineData: any;
  curriculums: Array<any> = [];
  listOfSchoolidValue: string[] = [];
  dataloading = false;
  disable = true;
  school: any [] = [];
  isSchoolLoading = false;
  // startdate = null;
  // enddate = null;
  searchFields = {
    curriculumid: '',
  }
  baselinetype = [
    {name: 'Baseline', value: 1},
    {name: 'Midline', value: 2},
    {name: 'Endline', value: 3}
  ];
  searchSchoolChange$ = new BehaviorSubject({
    schoolname: '',
  });

  async submitUpdateForm() {
    this.utilservice.checkFormDirty(this.editForm);
    if (this.editForm.valid && this.validate()) {
      // && this.validate()
      await this.dts
        .updateBaseline({
          curriculumid: this.editForm.getRawValue()['curriculumid'],
          // baselineid: this.editForm.getRawValue()['baselineid'],
          baselinename: this.editForm.getRawValue()['baselinename'],
          baselinetype: this.editForm.getRawValue()['baselinetype'],
          startdate: this.editForm.getRawValue()['startdate'],
          enddate: this.editForm.getRawValue()['enddate'],
          schoolid: this.editForm.getRawValue()['schoolid'],
          curriculumbaselineid: this.baslineData.curriculumbaselineid,
        })
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'Baseline curriculum updated successfully'
      );
      this.router.navigate(['baseline-curriculum/index']);
    }
  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
    private route: ActivatedRoute,
    private dts: BaseCurriculumService,
    private cts: CurriculumService,
    private schoolService: SchoolService,
  ) { }

  ngOnInit(): void {
    this.dataloading = true;
    this.setupSearchSchool();
    this.editForm = this.fb.group({
      curriculumid: [null, [Validators.required]],
      // baselineid: [null, [Validators.required]],
      baselinename: [null, [Validators.required]],
      baselinetype: [null, [Validators.required]],
      startdate: [null, [Validators.required]],
      enddate: [null, [Validators.required]],
      schoolid: [null, [Validators.required]]
    });

    const curriculumbaselineid = this.route.snapshot.paramMap.get('curriculumbaselineid') ?? '';
    if ((curriculumbaselineid || '').trim().length <= 0) {
      this.notification.create('error', 'error', 'Invalid link');
      this.router.navigate(['baseline-curriculum/index']);
      return;
    }
    this.dts.getcurriculumbaselineid(curriculumbaselineid)
      .pipe(first())
      .subscribe(
        (data: any)=>{
          if(data){
            this.baslineData = data.data;
            this.editForm.get('curriculumid')
              ?.setValue(this.baslineData.curriculumid);
            // this.editForm.get('baselineid')
            //   ?.setValue(this.baslineData.baselineid);
            this.editForm.get('baselinename')
              ?.setValue(this.baslineData.baselinename);
            this.editForm.get('baselinetype')
              ?.setValue(this.baslineData.baselinetype);
            this.editForm.get('startdate')
              ?.setValue(this.baslineData.startdate ?? null);
            this.editForm.get('enddate')
              ?.setValue(this.baslineData.enddate ?? null);
            this.editForm.get('schoolid')
              ?.setValue(this.baslineData.schoolid ?? this.school);
          }else if(data.error){
            this.notification.create('error', 'error', 'Invalid link');
            this.router.navigate(['baseline-curriculum/index']);
          }
        }
      )

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
  }

  validateDate() {
    const startDate = new Date(this.editForm.getRawValue()['startdate']);
    const endDate = new Date(this.editForm.getRawValue()['enddate']);
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
      this.editForm.getRawValue()['startdate'] < new Date() ||
      this.editForm.getRawValue()['enddate'] < new Date() ||
      this.editForm.getRawValue()['startdate'].value > this.editForm.getRawValue()['enddate'].value
    ) {
      this.notification.create(
        'warning',
        'warning',
        'Start Date or End Date should be greater than Current Date'
      );
      return false;
    } else  {
      return true;
    }
  }

  onSearchSchool(value: string): void {
    this.isSchoolLoading = true;
    this.searchSchoolChange$.next({
      schoolname: value,
    });
  }

  async SearchSchool(curriculumid: string){
    if(curriculumid){
      this.disable = false;
      this.searchFields.curriculumid = curriculumid;
      this.listOfSchoolidValue = [];
      this.setupSearchSchool();
    }
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
