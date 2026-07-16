import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { IPaging } from 'src/app/models/IPaging';
import { GradeService } from 'src/app/services/grade.service';
import { LevelService } from 'src/app/services/level.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-level-update',
  templateUrl: './level-update.component.html',
  styleUrls: ['./level-update.component.less'],

})
export class LevelUpdateComponent implements OnInit {
  dataloading = false;
  valid=false;
  editForm!: UntypedFormGroup;
  grades: Array<any> = [];
  level: any;
  async submiteditForm() {
    this.restrictSpecialCharecter();
    this.utilservice.checkFormDirty(this.editForm);
    if (this.editForm.valid && this.valid) {
      await this.dts.update({
        leveldescription: this.editForm.getRawValue()['leveldescription'] || "",
        levelname: this.editForm.getRawValue()['levelname'],
        levelid: this.level.levelid,
        gradeid: this.editForm.getRawValue()['gradeid'],
        levelorder: this.editForm.getRawValue()['levelorder'],
        quiz_points: this.editForm.getRawValue()['quiz_points'],
        passing_points: this.editForm.getRawValue()['passing_points']
      }).pipe(first()).toPromise();
      this.notification.create("success", 'Success', "Level updated sucessfully");
      this.router.navigate(['level/index']);
    } else {
      const scholname = this.editForm.get('levelname')?.value;
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
    private dts: LevelService, private route: ActivatedRoute,
    private cts: GradeService,
    private router: Router, private readonly notification: NzNotificationService,
    private utilservice: UtilService) { }

  async ngOnInit() {
    this.dataloading = true;
    this.editForm = this.fb.group({
      gradeid: [null, [Validators.required]],
      levelorder: [null, [Validators.required, Validators.min(1), Validators.max(100)]],
      levelname: [null, [Validators.required]],
      leveldescription: [null, [Validators.maxLength(500)]],
      quiz_points: [0, [Validators.required, Validators.min(0)]],
      passing_points: [0, [Validators.required, Validators.min(0)]],
    });
    let tempPage = new IPaging();
    tempPage.pagesize = 200;
    const data: any = await this.cts.getall(tempPage).toPromise();
    this.grades = data.data.data;
    const levelid = this.route.snapshot.paramMap.get("levelid") ?? "";
    if ((levelid || '').trim().length <= 0) {
      this.notification.create("error", 'error', "Invalid link");
      this.router.navigate(['level/index']);
      return;
    }
    this.dts.get(levelid).pipe(first()).subscribe((tempdata: any) => {
      if (tempdata.error) {
        this.notification.create("error", 'error', "Invalid link");
        this.router.navigate(['level/index']);
      }
      this.level = tempdata.data;
      this.editForm.get('levelname')?.setValue(this.level.levelname);
      this.editForm.get('leveldescription')?.setValue(this.level.leveldescription);
      this.editForm.get('gradeid')?.setValue(this.level.gradeid);
      this.editForm.get('levelorder')?.setValue(this.level.levelorder);
      this.editForm.get('quiz_points')?.setValue(this.level.quiz_points ?? 0);
      this.editForm.get('passing_points')?.setValue(this.level.passing_points ?? 0);
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
    const scholname = this.editForm.get('levelname')?.value;
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
