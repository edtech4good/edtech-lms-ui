import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable } from 'rxjs';
import { catchError, first, map } from 'rxjs/operators';
import { CountryService } from 'src/app/services/country.service';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { SchoolContributeService } from 'src/app/services/school-contribute.service';
import { SchoolService } from 'src/app/services/school.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-school-update',
  templateUrl: './school-update.component.html',
  styleUrls: ['./school-update.component.less'],
})
export class SchoolUpdateComponent implements OnInit {
  dataloading = false;
  country$?: Observable<any>;
  curriculums$?: Observable<any>;
  editForm!: FormGroup;
  valid = true;
  school: any;
  selectedSchool = true;
  schoolcontribute: any;

  async submiteditForm() {
    this.utilservice.checkFormDirty(this.editForm);
    if (this.editForm.valid && this.valid) {
      await this.dts
        .update({
          schoolname: this.editForm.getRawValue()['schoolname'],
          countryid: this.editForm.getRawValue()['countryid'],
          curriculums: this.editForm.getRawValue()['curriculums'],
          schoolid: this.school.schoolid
        })
        .pipe(first())
        .toPromise();
        if(this.schoolcontribute.length > 0 && this.schoolcontribute !== ''){
          this.schoolcontributeService
          .updateSchoolName({
            schoolname: this.editForm.getRawValue()['schoolname'],
            countryid: this.editForm.getRawValue()['countryid'],
            schoolid: this.school?.schoolid
          })
          .pipe(first())
          .toPromise();
        }
      this.notification.create(
        'success',
        'Success',
        'School updated successfully'
      );
      this.router.navigate(['school/index']);
    } else {
      if(this.editForm.get('schoolname')?.value !== null){
      this.notification.create(
        'error',
        'error',
        'Invalid Input'
      );
    }
    }
  }
  constructor(
    private fb: FormBuilder,
    private dts: SchoolService,
    private route: ActivatedRoute,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
    private readonly countryService: CountryService,
    private readonly curriculumService: CurriculumService,
    private readonly schoolcontributeService: SchoolContributeService
  ) {}

  ngOnInit(): void {
    this.dataloading = true;
    this.editForm = this.fb.group({
      schoolname: [null, [Validators.required]],
      countryid: [null, [Validators.required]],
      curriculums: [null, [Validators.required]],
    });
    // load all country
    this.country$ = this.countryService.getall({ pagesize: 200 }).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => {
        return x.data.data;
      })
    );
    this.country$.subscribe();
    // // all curriculums
    // this.curriculums$ = this.curriculumService.getall({ pagesize: 200 }).pipe(
    //   catchError((x: any) => []),
    //   first(),
    //   map((x: any) => {
    //     return x.data.data;
    //   })
    // );
    // this.curriculums$.subscribe();

    const schoolid = this.route.snapshot.paramMap.get('schoolid') ?? '';
    if ((schoolid || '').trim().length <= 0) {
      this.notification.create('error', 'error', 'Invalid link');
      this.router.navigate(['school/index']);
      return;
    }
    this.dts
      .get(schoolid)
      .pipe(first())
      .subscribe((tempdata: any) => {
        this.school = tempdata.data;
        this.editForm
          .get('schoolname')
          ?.setValue(this.school.schoolname);
        if(this.school.countryid) {
          this.editForm
            .get('countryid')
            ?.setValue(this.school.countryid);
          this.selectedSchool = false;
          this.curriculums$ = this.curriculumService.getByCountryid(this.school.countryid).pipe(
            catchError((x: any) => []),
            first(),
            map((x: any) => {
              return x.data;
            })
          );
          this.curriculums$.subscribe();
          this.editForm
            .get('curriculums')
            ?.setValue(this.school.curriculums);
        }
      },
      (error ) => {
        if (error) {
          this.notification.create('error', 'error', 'Invalid link');
          this.router.navigate(['country/index']);
        }
      },
      () => {
        setTimeout(() => {
          this.dataloading = false;
        }, 400);
      });

      // load schoolcontribute
      this.schoolcontributeService
      .getSchoolContributeById(schoolid)
      .pipe(first())
      .subscribe(
        (x:any)=>{
          this.schoolcontribute = x.data;
        }
      );
  }
  restrictSpecialCharecter(){
    const scholname=this.editForm.get('schoolname')?.value;
    var format = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
    // console.log('sc name is',scholname)
    if(format.test(scholname)){
      this.valid = false;
      this.notification.create(
        'warning',
        'warning',
        'Special characters are not allowed'
      );
      return;
    }  else{
      this.valid = true;
    }
  }
  onSelected(countryid: any){
    this.selectedSchool = false;
    if(countryid) {
      this.editForm.get('curriculums')?.setValue(null);
      this.curriculums$ = this.curriculumService.getByCountryid(countryid).pipe(
        catchError((x: any) => []),
        first(),
        map((x: any) => {
          return x.data;
        })
      );
      this.curriculums$.subscribe();
    }
  }
}
