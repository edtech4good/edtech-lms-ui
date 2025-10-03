import {
  Component,
  OnInit,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { CountryService } from 'src/app/services/country.service';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { SubjectService } from 'src/app/services/subject.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-subject-update',
  templateUrl: './subject-update.component.html',
  styleUrls: ['./subject-update.component.less'],
})
export class SubjectUpdateComponent implements OnInit {
  dataloading = false;
  valid = false;
  editForm!: FormGroup;
  subject: any;
  async submiteditForm() {
    this.restrictSpecialCharecter();
    this.utilservice.checkFormDirty(this.editForm);
    if (this.editForm.valid && this.valid) {
      await this.dts
        .update({
          subjectdescription:
            this.editForm.getRawValue()['subjectdescription'] || '',
          subjectname: this.editForm.getRawValue()['subjectname'],
          subjectid: this.subject.subjectid,
        })
        .pipe(first())
        .toPromise();
      setTimeout(() => {
        this.notification.create(
          'success',
          'Success',
          'Subject updated successfully'
        );
      }, 400);
      this.router.navigate(['subject/index']);
    } else {
      const subjectname = this.editForm.get('subjectname')?.value;
      var format = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
      if (format.test(subjectname)) {
        this.notification.create(
          'error',
          'error',
          'Special characters are not allowed'
        );
        return;
      }
    }
  }
  constructor(
    private fb: FormBuilder,
    private dts: SubjectService,
    private route: ActivatedRoute,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
  ) {}

  ngOnInit() {
    this.editForm = this.fb.group({
      subjectname: [null, [Validators.required]],
      subjectdescription: [
        null,
        [Validators.maxLength(500), Validators.min(3)],
      ],
    });
    const subjectid = this.route.snapshot.paramMap.get('subjectid') ?? '';
    if ((subjectid || '').trim().length <= 0) {
      this.notification.create('error', 'error', 'Invalid link');
      this.router.navigate(['subject/index']);
      return;
    }
    this.dts
      .get(subjectid)
      .pipe(first())
      .subscribe((tempdata: any) => {
        if (tempdata.error) {
          this.notification.create('error', 'error', 'Invalid link');
          this.router.navigate(['subject/index']);
        }
        this.subject = tempdata.data;
        this.editForm
          .get('subjectname')
          ?.setValue(this.subject.subjectname);
        this.editForm
          .get('subjectdescription')
          ?.setValue(this.subject.subjectdescription);
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
  restrictSpecialCharecter() {
    const subjectname = this.editForm.get('subjectname')?.value;
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
