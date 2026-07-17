import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable } from 'rxjs';
import { catchError, first, map } from 'rxjs/operators';
import { CountryService } from 'src/app/services/country.service';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { SchoolService } from 'src/app/services/school.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
    selector: 'app-school-create',
    templateUrl: './school-create.component.html',
    styleUrls: ['./school-create.component.less'],
    standalone: false
})
export class SchoolCreateComponent implements OnInit {
  dataloading = false;
  country$?: Observable<any>;
  createForm!: UntypedFormGroup;
  valid = true;
  selectedSchool = true;
  curriculums$?: Observable<any>;
  async submitcreateForm() {
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid && this.valid) {
      await this.dts
        .create(
          this.createForm.getRawValue()['schoolname'],
          this.createForm.getRawValue()['countryid'],
          this.createForm.getRawValue()['curriculums']
        )
        .pipe(first())
        .toPromise();
        setTimeout(() => {
          this.notification.create(
            'success',
            'Success',
            'School created sucessfully'
          );
        }, 400);
      this.router.navigate(['school/index']);
    } else {
      if (this.createForm.get('schoolname')?.value !== null) {
        this.notification.create('error', 'error', 'Invalid Input');
      }
    }
  }
  constructor(
    private fb: UntypedFormBuilder,
    private dts: SchoolService,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
    private readonly countryService: CountryService,
    private readonly curriculumService: CurriculumService
  ) {}

  ngOnInit(): void {
    this.dataloading = true;
    this.createForm = this.fb.group({
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
    setTimeout(() => {
      this.dataloading = false;
    }, 400);
  }
  restrictSpecialCharecter() {
    const scholname = this.createForm.get('schoolname')?.value;
    var format = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
    // console.log('sc name is', scholname);
    if (format.test(scholname)) {
      this.valid = false;
      this.notification.create(
        'warning',
        'warning',
        'Special characters are not allowed'
      );
      return;
    } else {
      this.valid = true;
    }
  }

  onSelected(countryid: any) {
    this.selectedSchool = false;
    this.createForm.get('curriculums')?.setValue(null);
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
