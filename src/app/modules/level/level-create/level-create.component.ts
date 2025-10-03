import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { IPaging } from 'src/app/models/IPaging';
import { GradeService } from 'src/app/services/grade.service';
import { LevelService } from 'src/app/services/level.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-level-create',
  templateUrl: './level-create.component.html',
  styleUrls: ['./level-create.component.less']
})
export class LevelCreateComponent implements OnInit {
  dataloading = false;
  valid= true;
  createForm!: FormGroup;
  grades: Array<any> = [];
  async submitcreateForm() {
    this.utilservice.checkFormDirty(this.createForm);

    if (this.createForm.valid && this.valid) {
      await this.dts.create(this.createForm.getRawValue()['levelname'],
        this.createForm.getRawValue()['leveldescription'] || "",
        this.createForm.getRawValue()['gradeid'],
        this.createForm.getRawValue()['levelorder'],
        this.createForm.getRawValue()['quiz_points'],
        this.createForm.getRawValue()['passing_points'],
      ).pipe(first()).toPromise();
      this.notification.create("success", 'Success', "Level created sucessfully");
      this.router.navigate(['level/index']);
    } else {
      if (this.createForm.valid && this.createForm.get('levelname')?.value !== null && this.createForm.get('levelname')?.value !== '') {
        this.notification.create(
          'error',
          'error',
          'Special characters are not allowed'
        );
      }
    }

  }
  constructor(private fb: FormBuilder,
    private dts: LevelService,
    private cts: GradeService,
    private router: Router, private readonly notification: NzNotificationService,
    private utilservice: UtilService) {

  }

  async ngOnInit() {
    this.dataloading = true;
    this.createForm = this.fb.group({
      gradeid: [null, [Validators.required]],
      levelorder: [null, [Validators.required, Validators.min(1), Validators.max(100)]],
      levelname: [null, [Validators.required]],
      leveldescription: [null, [Validators.maxLength(500)]],
      quiz_points: [0, [Validators.required, Validators.min(0)]],
      passing_points: [0, [Validators.required, Validators.min(0)]],
    });
    let tempPage = new IPaging();
    tempPage.pagesize = 200;
    // const data: any = await
    this.cts
    .getall(tempPage)
    .pipe(first())
    .subscribe(
      (data: any) => {
        this.grades = data.data.data;
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
    const scholname = this.createForm.get('levelname')?.value;
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
