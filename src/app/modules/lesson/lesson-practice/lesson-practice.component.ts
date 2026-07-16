import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { LessonPracticeService } from 'src/app/services/lesson.practice.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-lesson-practice',
  templateUrl: './lesson-practice.component.html',
  styleUrls: ['./lesson-practice.component.less'],
})
export class LessonPracticeComponent implements OnInit {
  dataloading = false;
  isUpdateLessonPractice = false;
  invalidOrder = true;
  data: Array<any> = [];
  createForm!: UntypedFormGroup;
  showModalAddPractice = false;
  lesson_id = this.route.snapshot.paramMap.get('lessonid') ?? '';

  async loadDataFromServer() {
    const lessonid = this.lesson_id;
    // const tempdata: any = await
    this.lessonpracticeService
      .getpractices(lessonid)
      .pipe(first())
      .subscribe(
        (tempdata: any) => {
          this.data = tempdata.data;
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

  async handleModalPractice() {
    this.isUpdateLessonPractice
      ? await this.handleModalUpdatePractice()
      : await this.handleModalAddPractice();
  }

  private async handleModalAddPractice() {
    const lessonid = this.lesson_id
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid && this.invalidOrder) {
      await this.lessonpracticeService
        .addpractice(lessonid, { ...this.createForm.value })
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'Practice added sucessfully'
      );
      await this.loadDataFromServer();
      this.showModalAddPractice = false;
    } else {
      if(this.createForm.valid  &&  this.createForm.get('lessonpracticeorder')?.value!==null){
        this.notification.create('error', 'error', 'Duplicate order number');
      }    }
  }

  private async handleModalUpdatePractice() {
    const lessonid = this.lesson_id;
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid) {
      await this.lessonpracticeService
        .updatepractice(this.createForm.getRawValue()['lessonpracticeid'], {
          ...this.createForm.value,
          lessonid,
        })
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'Practice updated sucessfully'
      );
      await this.loadDataFromServer();
      this.showModalAddPractice = false;
    }
  }

  constructor(
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    private utilservice: UtilService,
    private lessonpracticeService: LessonPracticeService,
    private readonly notification: NzNotificationService,
    public sanitizer: DomSanitizer
  ) {}

  async ngOnInit() {
    this.dataloading = true;
    await this.loadDataFromServer();
  }

  showModelAddPractice = () => {
    this.isUpdateLessonPractice = false;
    this.createForm = this.fb.group({
      lessonpracticeorder: [
        null,
        [Validators.required, Validators.min(1), Validators.max(100)],
      ],
      lessonpracticename: [
        null,
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
        ],
      ],
      lessonpracticedescription: [
        null,
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(500),
        ],
      ],
      points: [
        10,
        [Validators.required, Validators.min(1)],
      ],
    });
    this.showModalAddPractice = true;
  };

  showModelUpdatePractice = async (lessonpracticeid: string) => {
    const lessonid = this.route.snapshot.paramMap.get('lessonid') ?? '';
    this.isUpdateLessonPractice = true;
    this.createForm = this.fb.group({
      lessonpracticeid: [lessonpracticeid, [Validators.required]],
      lessonpracticename: [
        null,
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
        ],
      ],
      lessonpracticedescription: [
        null,
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(500),
        ],
      ],
      points: [
        10,
        [
          Validators.required, Validators.minLength(1),
        ],
      ],
    });
    this.lessonpracticeService
      .getpractice(lessonid, lessonpracticeid)
      .pipe(first())
      .subscribe((tempdata: any) => {
        if (tempdata.error) {
          this.notification.create('error', 'error', 'Invalid link');
        }
        this.createForm
          .get('lessonpracticename')
          ?.setValue(tempdata.data.lessonpracticename);
        this.createForm
          .get('lessonpracticedescription')
          ?.setValue(tempdata.data.lessonpracticedescription);
        this.createForm
          .get('points')
          ?.setValue(tempdata.data.points);
        this.showModalAddPractice = true;
      });
  };
  hideModalAddPractice = () => {
    this.showModalAddPractice = false;
  };
  reorder = async (index: number) => {
    let old = this.data[index];
    let newdata = this.data[index - 1];
    await this.lessonpracticeService
      .reorderpractice(old.lessonpracticeid, newdata.lessonpracticeorder)
      .pipe(first())
      .toPromise();
    await this.lessonpracticeService
      .reorderpractice(newdata.lessonpracticeid, old.lessonpracticeorder)
      .pipe(first())
      .toPromise();
    await this.loadDataFromServer();
  };

  activatepractice = async (lessonpracticeid: string) => {
    await this.lessonpracticeService
      .activatepractice(lessonpracticeid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Practice activated sucessfully'
    );
    await this.loadDataFromServer();
  };

  deactivatepractice = async (lessonpracticeid: string) => {
    await this.lessonpracticeService
      .deactivatepractice(lessonpracticeid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Practice deactivated sucessfully'
    );
    await this.loadDataFromServer();
  };

  deletepractice = async (lessonpracticeid: string) => {
    await this.lessonpracticeService
      .deletepractice(lessonpracticeid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Practice deleted sucessfully'
    );
    await this.loadDataFromServer();
  };
  validateDuplication() {
    const orderValue = this.createForm.get('lessonpracticeorder')?.value;
    console.log('order value',orderValue)
    this.invalidOrder = true;
    this.data.filter((e) => {
      if (
        e.lessonpracticeorder.length !== 0 || e.lessonpracticeorder.length !== undefined
      ) {
        if (Number(e.lessonpracticeorder) === Number(orderValue)) {
          this.invalidOrder = false;
        }
      }
    });
  }
}
