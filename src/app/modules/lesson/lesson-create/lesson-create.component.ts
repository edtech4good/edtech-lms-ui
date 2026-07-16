import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { IPaging } from 'src/app/models/IPaging';
import { LevelService } from 'src/app/services/level.service';
import { LessonService } from 'src/app/services/lesson.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-lesson-create',
  templateUrl: './lesson-create.component.html',
  styleUrls: ['./lesson-create.component.less'],
})
export class LessonCreateComponent implements OnInit {
  dataloading = false;
  createForm!: UntypedFormGroup;
  valid = false;
  levels: Array<any> = [];
  async submitcreateForm() {
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid && this.valid) {
      await this.dts
        .create(
          this.createForm.getRawValue()['lessonname'],
          this.createForm.getRawValue()['lessondescription'] || '',
          this.createForm.getRawValue()['levelid'],
          this.createForm.getRawValue()['lessonorder'],
          this.createForm.getRawValue()['total_points'],
          this.createForm.getRawValue()['passing_points']
        )
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'Lesson created sucessfully'
      );
      sessionStorage.removeItem('lessonData');
      sessionStorage.removeItem('tempData');
      sessionStorage.removeItem('filter');
      this.router.navigate(['lesson/index']);
    } else {
      if (
        this.createForm.valid && this.createForm.get('lessonname')?.value !== '') {
        const scholname = this.createForm.get('lessonname')?.value;
        var format = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
        if (format.test(scholname)) {
          this.notification.create(
            'error',
            'error',
            'Special characters are not allowed'
          );
          return;
        }
      }
    }
  }
  constructor(
    private fb: UntypedFormBuilder,
    private dts: LessonService,
    private cts: LevelService,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService
  ) {}

  async ngOnInit() {
    this.dataloading = true;
    this.createForm = this.fb.group({
      levelid: [null, [Validators.required]],
      lessonorder: [
        null,
        [Validators.required, Validators.min(1), Validators.max(100)],
      ],
      lessonname: [null, [Validators.required]],
      lessondescription: [null, [Validators.maxLength(500)]],
      total_points: [100, [Validators.min(10)]],
      passing_points: [0, [Validators.min(0)]],
    });
    let tempPage = new IPaging();
    tempPage.pagesize = 200;
    // const data: any = await
    this.cts
    .getall(tempPage)
    .subscribe(
      (data: any) => {
        this.levels = data.data.data;
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
      }
    )
  }

  restrictSpecialCharecter() {
    const scholname = this.createForm.get('lessonname')?.value;
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
