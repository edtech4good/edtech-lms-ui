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
    selector: 'app-subject-create',
    templateUrl: './subject-create.component.html',
    styleUrls: ['./subject-create.component.less'],
    standalone: false
})
export class SubjectCreateComponent implements OnInit {
  dataloading = false
  createForm!: UntypedFormGroup;
  valid = false;
  async submitcreateForm() {
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid && this.valid) {
      await this.dts
        .create(
          this.createForm.getRawValue()['subjectname'],
          this.createForm.getRawValue()['subjectdescription'] || '',
        )
        .pipe(first())
        .toPromise();
        setTimeout(() => {
          this.notification.create(
            'success',
            'Success',
            'Subject created sucessfully'
          );
        }, 400);
      this.router.navigate(['subject/index']);
    } else {
      if (this.createForm.get('subjectname')?.value !== null && this.createForm.get('subjectname')?.value !== '' ) {
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
    private dts: SubjectService,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
  ) {}

  ngOnInit(): void {
    this.createForm = this.fb.group({
      subjectname: [null, [Validators.required]],
      subjectdescription: [
        null,
        [Validators.maxLength(500)],
      ],
    });
  }

  restrictSpecialCharecter() {
    const subjectname = this.createForm.get('subjectname')?.value;
    var format = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
    if (format.test(subjectname)) {
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
