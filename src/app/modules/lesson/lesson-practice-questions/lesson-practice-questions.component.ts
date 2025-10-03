import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, Observable, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  first,
  map,
  switchMap,
} from 'rxjs/operators';
import { IPaging } from 'src/app/models/IPaging';
import { LessonPracticeQuestionService } from 'src/app/services/lesson.practice.question.service';
import { UtilService } from 'src/app/services/util.service';
import { QuestionService } from '../../question/services/question.service';

@Component({
  selector: 'app-lesson-practice-questions',
  templateUrl: './lesson-practice-questions.component.html',
  styleUrls: ['./lesson-practice-questions.component.less'],
})
export class LessonPracticeQuestionsComponent implements OnInit {
  invalidOrder = false;
  practicId: any;
  data: Array<any> = [];
  createForm!: FormGroup;
  questionoptionList: any[] = [];
  showModalAddQuestion = false;
  private questionsearchChange$ = new BehaviorSubject('');
  questionisLoading = false;
  id = this.route.snapshot.paramMap.get('lessonid') ?? '';

  goProducts() {
    this.router.navigate(
      ['/lesson','practice', this.id],
      { queryParams: { order: 'practice-question'} }
    );
  }

  async loadDataFromServer() {
    const lessonpracticeid =
      this.route.snapshot.paramMap.get('lessonpracticeid') ?? '';
    const tempdata: any = await this.lessonPracticeQuestionService
      .getpracticequestion(lessonpracticeid)
      .pipe(first())
      .toPromise();
    this.data = tempdata.data;
  }

  async handleModalAddQuestion() {
    const lessonpracticeid =
      this.route.snapshot.paramMap.get('lessonpracticeid') ?? '';
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid && this.invalidOrder) {
      await this.lessonPracticeQuestionService
        .addpracticequestion(
          lessonpracticeid,
          this.createForm.getRawValue()['questionid'],
          this.createForm.getRawValue()['lessonpracticequestionorder']
        )
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'Question added sucessfully'
      );
      await this.loadDataFromServer();
      this.showModalAddQuestion = false;
    } else {
      if (this.createForm.get('lessonpracticequestionorder')?.value !== null) {
        this.notification.create('error', 'error', 'Duplicate order number');
      }
    }
  }

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private utilservice: UtilService,
    private lessonPracticeQuestionService: LessonPracticeQuestionService,
    private readonly notification: NzNotificationService,
    private questionService: QuestionService
  ) {}

  async ngOnInit() {
    this.practicId = this.route.snapshot.paramMap.get('lessonpracticeid') ?? '';
    console.log('practice id is', this.practicId);
    const getquestion = (filename: string) => {
      let temp = new IPaging();
      temp.pagesize = 20;
      temp.filter = [
        {
          key: 'questiontags',
          value: filename || '----',
        },
        {
          key: 'questionidentifier',
          value: filename || '----',
        },
      ];
      const httpobject = this.questionService.getallOR(temp).pipe(
        catchError(async () => ({ data: { data: [] } })),
        map((res: any) => res.data.data)
      );
      return httpobject;
    };
    const questionoptionList$: Observable<string[]> = this.questionsearchChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(getquestion));
    questionoptionList$.subscribe((data) => {
      this.questionoptionList = data;
      this.questionisLoading = false;
    });

    await this.loadDataFromServer();
  }
  showModelAddQuestion = () => {
    this.createForm = this.fb.group({
      questionid: [null, [Validators.required]],
      lessonpracticequestionorder: [
        null,
        [Validators.required, Validators.min(1), Validators.max(100)],
      ],
    });
    this.showModalAddQuestion = true;
  };
  hideModalAddQuestion = () => {
    this.showModalAddQuestion = false;
  };
  reorder = async (index: number) => {
    let old = this.data[index];
    let newdata = this.data[index - 1];
    await this.lessonPracticeQuestionService
      .reorderpracticequestion(
        old.lessonpracticequestionid,
        newdata.lessonpracticequestionorder
      )
      .pipe(first())
      .toPromise();
    await this.lessonPracticeQuestionService
      .reorderpracticequestion(
        newdata.lessonpracticequestionid,
        old.lessonpracticequestionorder
      )
      .pipe(first())
      .toPromise();
    await this.loadDataFromServer();
  };

  activatequestion = async (lessonpracticequestionid: string) => {
    await this.lessonPracticeQuestionService
      .activatepracticequestion(lessonpracticequestionid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Question activated sucessfully'
    );
    await this.loadDataFromServer();
  };

  deactivatequestion = async (lessonpracticequestionid: string) => {
    await this.lessonPracticeQuestionService
      .deactivatepracticequestion(lessonpracticequestionid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Question deactivated sucessfully'
    );
    await this.loadDataFromServer();
  };

  deletequestion = async (lessonpracticequestionid: string) => {
    await this.lessonPracticeQuestionService
      .deletepracticequestion(lessonpracticequestionid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Question deleted sucessfully'
    );
    await this.loadDataFromServer();
  };

  questioncreateonSearch(value: string): void {
    this.questionisLoading = true;
    if ((value || '').trim().length <= 2) {
      return;
    }
    this.questionsearchChange$.next(value);
  }

  validateDuplication() {
    const orderValue = this.createForm.get(
      'lessonpracticequestionorder'
    )?.value;
    this.invalidOrder = true;
    this.data.filter((e) => {
      if (Number(e.lessonpracticequestionorder) === Number(orderValue)) {
        this.invalidOrder = false;
      }
    });
  }
}
