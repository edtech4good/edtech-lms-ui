import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { IPaging } from 'src/app/models/IPaging';
import { LevelService } from 'src/app/services/level.service';
import { LessonService } from 'src/app/services/lesson.service';
import { UtilService } from 'src/app/services/util.service';
import { Location } from '@angular/common';

@Component({
    selector: 'app-lesson-update',
    templateUrl: './lesson-update.component.html',
    styleUrls: ['./lesson-update.component.less'],
    standalone: false
})
export class LessonUpdateComponent implements OnInit {
  dataloading = false;
  valid =false;
  editForm!: UntypedFormGroup;
  levels: Array<any> = [];
  lesson: any;
  length:number = 10;
  async submiteditForm() {
    this.restrictSpecialCharecter();
    this.utilservice.checkFormDirty(this.editForm);
    if (this.editForm.valid && this.valid) {
      await this.dts.update({
        lessondescription: this.editForm.getRawValue()['lessondescription'] || "",
        lessonname: this.editForm.getRawValue()['lessonname'],
        lessonid: this.lesson.lessonid,
        levelid: this.editForm.getRawValue()['levelid'],
        lessonorder: this.editForm.getRawValue()['lessonorder'],
        total_points: this.editForm.getRawValue()['total_points'],
        passing_points: this.editForm.getRawValue()['passing_points'],
      }).pipe(first()).toPromise();
      this.notification.create("success", 'Success', "Lesson updated sucessfully");
      this.router.navigate(['lesson/index']);
    } else {
      const scholname = this.editForm.get('lessonname')?.value;
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
  constructor(
    private fb: UntypedFormBuilder,
    private dts: LessonService,
    private route: ActivatedRoute,
    private cts: LevelService,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
    public _location: Location
  ) { }

  async ngOnInit() {
    this.dataloading = true;
    this.editForm = this.fb.group({
      levelid: [null, [Validators.required]],
      lessonorder: [null, [Validators.required, Validators.min(1), Validators.max(100)]],
      lessonname: [null, [Validators.required]],
      lessondescription: [null, [Validators.maxLength(500)]],
      total_points: [100, [Validators.min(10)]],
      passing_points: [0, [Validators.min(0)]],
    });
    let tempPage = new IPaging();
    tempPage.pagesize = 200;
    const data: any = await this.cts.getall(tempPage).toPromise();
    this.levels = data.data.data;
    const lessonid = this.route.snapshot.paramMap.get("lessonid") ?? "";
    if ((lessonid || '').trim().length <= 0) {
      this.notification.create("error", 'error', "Invalid link");
      this.router.navigate(['lesson/index']);
      return;
    }
    this.dts.get(lessonid).pipe(first()).subscribe((tempdata: any) => {
      this.lesson = tempdata.data;
      this.editForm.get('lessonname')?.setValue(this.lesson.lessonname);
      this.editForm.get('lessondescription')?.setValue(this.lesson.lessondescription);
      this.editForm.get('levelid')?.setValue(this.lesson.levelid);
      this.editForm.get('lessonorder')?.setValue(this.lesson.lessonorder);
      this.editForm.get('total_points')?.setValue(this.lesson.total_points ?? 100);
      this.editForm.get('passing_points')?.setValue(this.lesson.passing_points ?? 0);
    },
    (error) => {
      if(error){
        this.notification.create("error", 'error', "Invalid link");
        this.router.navigate(['lesson/index']);
      }
    },
    () => {
      setTimeout(() => {
        this.dataloading = false;
      }, 400);
    });
  }
  restrictSpecialCharecter() {
    const scholname = this.editForm.get('lessonname')?.value;
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

  // refresh(){
  //   this.router.navigateByUrl("",{ skipLocationChange: true}).then(()=>{
  //     this.router.navigate([decodeURI(this._location.path())])
  //   })
  // }
}
