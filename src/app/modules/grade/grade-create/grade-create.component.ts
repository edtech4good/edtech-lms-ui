import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { IPaging } from 'src/app/models/IPaging';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { GradeService } from 'src/app/services/grade.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-grade-create',
  templateUrl: './grade-create.component.html',
  styleUrls: ['./grade-create.component.less'],
})
export class GradeCreateComponent implements OnInit {
  dataloading = false;
  createForm!: UntypedFormGroup;
  curriculums: Array<any> = [];
  valid = true;

  async submitcreateForm() {
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid && this.valid) {
      await this.dts
        .create(
          this.createForm.getRawValue()['gradename'],
          this.createForm.getRawValue()['gradedescription'] || '',
          this.createForm.getRawValue()['curriculumid'],
          this.createForm.getRawValue()['gradeorder'],
          this.createForm.getRawValue()['passing_points']
        )
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'Grade created sucessfully'
      );
      this.router.navigate(['grade/index']);
    } else {
      if (
        this.createForm.get('gradename')?.value !== null && this.createForm.get('gradename')?.value !== '') {
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
    private dts: GradeService,
    private cts: CurriculumService,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService
  ) {}

  async ngOnInit() {
    this.dataloading = true;
    this.createForm = this.fb.group({
      curriculumid: [null, [Validators.required]],
      gradeorder: [
        null,
        [Validators.required, Validators.min(1), Validators.max(100)],
      ],
      gradename: [null, [Validators.required]],
      gradedescription: [null, [Validators.maxLength(500)]],
      passing_points: [
        0, [Validators.required, Validators.min(0)],
      ],
    });
    let tempPage = new IPaging();
    tempPage.pagesize = 200;
    // const data: any = await
    this.cts
    .getall(tempPage)
    .pipe(first())
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

  restrictSpecialCharecter() {
    const scholname = this.createForm.get('gradename')?.value;
    var format = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
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
