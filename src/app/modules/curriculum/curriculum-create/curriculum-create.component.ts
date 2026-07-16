import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable } from 'rxjs';
import { catchError, first, map } from 'rxjs/operators';
import { CountryService } from 'src/app/services/country.service';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { SubjectService } from 'src/app/services/subject.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-curriculum-create',
  templateUrl: './curriculum-create.component.html',
  styleUrls: ['./curriculum-create.component.less'],
})
export class CurriculumCreateComponent implements OnInit {
  dataloading = false
  country$?: Observable<any>;
  subject$?: Observable<any>;
  createForm!: UntypedFormGroup;
  valid = false;
  async submitcreateForm() {
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid && this.valid) {
      await this.dts
        .create(
          this.createForm.getRawValue()['curriculumname'],
          this.createForm.getRawValue()['curriculumdescription'] || '',
          this.createForm.getRawValue()['countryid'],
          this.createForm.getRawValue()['subjectid'],
        )
        .pipe(first())
        .toPromise();
        setTimeout(() => {
          this.notification.create(
            'success',
            'Success',
            'Curriculum created sucessfully'
          );
        }, 400);
      this.router.navigate(['curriculum/index']);
    } else {
      if (this.createForm.get('curriculumname')?.value !== null && this.createForm.get('curriculumname')?.value !== '' ) {
        this.notification.create(
          'error',
          'error',
          'Special characters are not allowed'
        );
      }
    }
  }
  constructor(
    private fb: UntypedFormBuilder,
    private dts: CurriculumService,
    private subjectService: SubjectService,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
    private readonly countryService: CountryService,
  ) {}

  ngOnInit(): void {
    this.dataloading = true;
    this.createForm = this.fb.group({
      curriculumname: [null, [Validators.required]],
      curriculumdescription: [
        null,
        [Validators.maxLength(500)],
      ],
      countryid: [null, [Validators.required]],
      subjectid: [null, [Validators.required]],
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
    // load all subject
    this.subject$ = this.subjectService.getall({ pagesize: 200 }).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => {
        return x.data.data;
      })
    );
    this.subject$.subscribe();
    setTimeout(() => {
      this.dataloading = false;
    }, 400);
  }

  restrictSpecialCharecter() {
    const scholname = this.createForm.get('curriculumname')?.value;
    var format = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
    console.log('curriculumname name is', scholname);
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
}
