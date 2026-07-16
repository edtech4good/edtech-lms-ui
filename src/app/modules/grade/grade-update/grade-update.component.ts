import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { IPaging } from 'src/app/models/IPaging';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { GradeService } from 'src/app/services/grade.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-grade-update',
  templateUrl: './grade-update.component.html',
  styleUrls: ['./grade-update.component.less'],

})
export class GradeUpdateComponent implements OnInit {
  dataloading = false;
  valid = false;
  editForm!: UntypedFormGroup;
  curriculums: Array<any> = [];
  grade: any;
  async submiteditForm() {
    this.restrictSpecialCharecter();
    this.utilservice.checkFormDirty(this.editForm);
    if (this.editForm.valid && this.valid) {
      await this.dts.update({
        gradedescription: this.editForm.getRawValue()['gradedescription'] || "",
        gradename: this.editForm.getRawValue()['gradename'],
        gradeid: this.grade.gradeid,
        curriculumid: this.editForm.getRawValue()['curriculumid'],
        gradeorder: this.editForm.getRawValue()['gradeorder'],
        passing_points: this.editForm.getRawValue()['passing_points'],
      }).pipe(first()).toPromise();
      this.notification.create("success", 'Success', "Grade updated sucessfully");
      this.router.navigate(['grade/index']);
    } else {
      const scholname = this.editForm.get('gradename')?.value;
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
  constructor(private fb: UntypedFormBuilder,
    private dts: GradeService, private route: ActivatedRoute,
    private cts: CurriculumService,
    private router: Router, private readonly notification: NzNotificationService,
    private utilservice: UtilService) { }

  async ngOnInit() {
    this.dataloading = true;
    this.editForm = this.fb.group({
      curriculumid: [null, [Validators.required]],
      gradeorder: [null, [Validators.required, Validators.min(1), Validators.max(100)]],
      gradename: [null, [Validators.required]],
      gradedescription: [null, [Validators.maxLength(500)]],
      passing_points: [0, [Validators.required, Validators.min(0)]],
    });
    let tempPage = new IPaging();
    tempPage.pagesize = 200;
    const data: any = await this.cts.getall(tempPage).toPromise();
    this.curriculums = data.data.data;
    const gradeid = this.route.snapshot.paramMap.get("gradeid") ?? "";
    if ((gradeid || '').trim().length <= 0) {
      this.notification.create("error", 'error', "Invalid link");
      this.router.navigate(['grade/index']);
      return;
    }
    this.dts.get(gradeid).pipe(first()).subscribe((tempdata: any) => {
      this.grade = tempdata.data;
      this.editForm.get('gradename')?.setValue(this.grade.gradename);
      this.editForm.get('gradedescription')?.setValue(this.grade.gradedescription);
      this.editForm.get('curriculumid')?.setValue(this.grade.curriculumid);
      this.editForm.get('gradeorder')?.setValue(this.grade.gradeorder);
      this.editForm.get('passing_points')?.setValue(this.grade.passing_points ?? 0);
    },
    (error) => {
      if(error) {
        this.notification.create("error", 'error', "Invalid link");
        this.router.navigate(['grade/index']);
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
    const scholname = this.editForm.get('gradename')?.value;
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
