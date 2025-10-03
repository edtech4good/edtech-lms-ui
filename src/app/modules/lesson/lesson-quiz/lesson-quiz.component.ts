import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { LessonQuizService } from 'src/app/services/lesson.quiz.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-lesson-quiz',
  templateUrl: './lesson-quiz.component.html',
  styleUrls: ['./lesson-quiz.component.less'],
})
export class LessonQuizComponent implements OnInit {
  dataloading = false;
  isUpdateLessonQuiz = false;
  invalidOrder = false;
  data: Array<any> = [];
  createForm!: FormGroup;
  showModalAddQuiz = false;
  async loadDataFromServer() {
    const lessonid = this.route.snapshot.paramMap.get('lessonid') ?? '';
    // const tempdata: any = await
    this.lessonquizService
      .getquizs(lessonid)
      .pipe(first())
      .subscribe(
        (tempdata: any) => {
          this.data = tempdata.data;
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

  async handleModalQuiz() {
    this.isUpdateLessonQuiz
      ? await this.handleModalUpdateQuiz()
      : await this.handleModalAddQuiz();
  }

  private async handleModalAddQuiz() {
    const lessonid = this.route.snapshot.paramMap.get('lessonid') ?? '';
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid && this.invalidOrder) {
      await this.lessonquizService
        .addquiz(lessonid, { ...this.createForm.value })
        .pipe(first())
        .toPromise();
      this.notification.create('success', 'Success', 'Quiz added sucessfully');
      await this.loadDataFromServer();
      this.showModalAddQuiz = false;
    } else {
      if(this.createForm.valid && this.createForm.get('lessonquizorder')?.value!==null){
        this.notification.create('error', 'error', 'Duplicate order number');
      }
    }
  }

  private async handleModalUpdateQuiz() {
    const lessonid = this.route.snapshot.paramMap.get('lessonid') ?? '';
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid) {
      await this.lessonquizService
        .updatequiz(this.createForm.getRawValue()['lessonquizid'], {
          ...this.createForm.value,
          lessonid,
        })
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'Quiz updated sucessfully'
      );
      await this.loadDataFromServer();
      this.showModalAddQuiz = false;
    }
  }

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private utilservice: UtilService,
    private lessonquizService: LessonQuizService,
    private readonly notification: NzNotificationService,
    public sanitizer: DomSanitizer
  ) {}

  async ngOnInit() {
    this.dataloading = true;
    await this.loadDataFromServer();
  }
  showModelAddQuiz = () => {
    this.isUpdateLessonQuiz = false;
    this.createForm = this.fb.group({
      lessonquizorder: [
        null,
        [Validators.required, Validators.min(1), Validators.max(100)],
      ],
      lessonquizname: [
        null,
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
        ],
      ],
      lessonquizdescription: [
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
          Validators.required,
          Validators.minLength(1),
        ],
      ],
    });
    this.showModalAddQuiz = true;
  };

  showModelUpdateQuiz = async (lessonquizid: string) => {
    const lessonid = this.route.snapshot.paramMap.get('lessonid') ?? '';
    this.isUpdateLessonQuiz = true;
    this.createForm = this.fb.group({
      lessonquizid: [lessonquizid, [Validators.required]],
      lessonquizname: [
        null,
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
        ],
      ],
      lessonquizdescription: [
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
          Validators.required,
          Validators.minLength(1),
        ],
      ],
    });
    this.lessonquizService
      .getquiz(lessonid, lessonquizid)
      .pipe(first())
      .subscribe((tempdata: any) => {
        if (tempdata.error) {
          this.notification.create('error', 'error', 'Invalid link');
        }
        this.createForm
          .get('lessonquizname')
          ?.setValue(tempdata.data.lessonquizname);
        this.createForm
          .get('lessonquizdescription')
          ?.setValue(tempdata.data.lessonquizdescription);
        this.createForm
          .get('points')
          ?.setValue(tempdata.data.points);
        this.showModalAddQuiz = true;
      });
  };
  hideModalAddQuiz = () => {
    this.showModalAddQuiz = false;
  };
  reorder = async (index: number) => {
    let old = this.data[index];
    let newdata = this.data[index - 1];
    await this.lessonquizService
      .reorderquiz(old.lessonquizid, newdata.lessonquizorder)
      .pipe(first())
      .toPromise();
    await this.lessonquizService
      .reorderquiz(newdata.lessonquizid, old.lessonquizorder)
      .pipe(first())
      .toPromise();
    await this.loadDataFromServer();
  };

  activatequiz = async (lessonquizid: string) => {
    await this.lessonquizService
      .activatequiz(lessonquizid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Quiz activated sucessfully'
    );
    await this.loadDataFromServer();
  };

  deactivatequiz = async (lessonquizid: string) => {
    await this.lessonquizService
      .deactivatequiz(lessonquizid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Quiz deactivated sucessfully'
    );
    await this.loadDataFromServer();
  };

  deletequiz = async (lessonquizid: string) => {
    await this.lessonquizService
      .deletequiz(lessonquizid)
      .pipe(first())
      .toPromise();
    this.notification.create('success', 'Success', 'Quiz deleted sucessfully');
    await this.loadDataFromServer();
  };

  validateDuplication() {
    const orderValue = this.createForm.get('lessonquizorder')?.value;
    this.invalidOrder = true;
    this.data.filter((e) => {
      if (Number(e.lessonquizorder) === Number(orderValue)) {
        this.invalidOrder = false;
      }
    });
  }
}
