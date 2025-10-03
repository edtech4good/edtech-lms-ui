import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, of, Observable } from 'rxjs';
import {
  catchError,
  debounceTime,
  first,
  map,
  switchMap,
} from 'rxjs/operators';
import { IPaging } from 'src/app/models/IPaging';
import { LessonQuizQuestionService } from 'src/app/services/lesson.quiz.question.service';
import { UtilService } from 'src/app/services/util.service';
import { QuestionService } from '../../question/services/question.service';

@Component({
  selector: 'app-lesson-quiz-questions',
  templateUrl: './lesson-quiz-questions.component.html',
  styleUrls: ['./lesson-quiz-questions.component.less'],
})
export class LessonQuizQuestionsComponent implements OnInit {
  dataloading = false;
  invalidOrder = true;
  quizId: any;
  data: Array<any> = [];
  createForm!: FormGroup;
  questionoptionList: any[] = [];
  showModalAddQuestion = false;
  private questionsearchChange$ = new BehaviorSubject('');
  questionisLoading = false;
  async loadDataFromServer() {
    const lessonquizid = this.route.snapshot.paramMap.get('lessonquizid') ?? '';
    const tempdata: any = await this.lessonQuizQuestionService
      .getquizquestion(lessonquizid)
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
      );

  }

  async handleModalAddQuestion() {
    const lessonquizid = this.route.snapshot.paramMap.get('lessonquizid') ?? '';
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid && this.invalidOrder) {
      await this.lessonQuizQuestionService
        .addquizquestion(
          lessonquizid,
          this.createForm.getRawValue()['questionid'],
          this.createForm.getRawValue()['lessonquizquestionorder']
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
      if (this.createForm.valid && this.createForm.get('lessonquizquestionorder')?.value !== null) {
        this.notification.create('error', 'error', 'Duplicate order number');
      }
    }
  }

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private utilservice: UtilService,
    private lessonQuizQuestionService: LessonQuizQuestionService,
    private readonly notification: NzNotificationService,
    private questionService: QuestionService
  ) {
    this.route.params.subscribe((params) => {
      (this.quizId = params.lessonquizid), console.log(params.lessonquizid);
    });
  }

  async ngOnInit() {
    this.dataloading = true;
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
      lessonquizquestionorder: [
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
    await this.lessonQuizQuestionService
      .reorderquizquestion(
        old.lessonquizquestionid,
        newdata.lessonquizquestionorder
      )
      .pipe(first())
      .toPromise();
    await this.lessonQuizQuestionService
      .reorderquizquestion(
        newdata.lessonquizquestionid,
        old.lessonquizquestionorder
      )
      .pipe(first())
      .toPromise();
    await this.loadDataFromServer();
  };

  activatequestion = async (lessonquizquestionid: string) => {
    await this.lessonQuizQuestionService
      .activatequizquestion(lessonquizquestionid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Question activated sucessfully'
    );
    await this.loadDataFromServer();
  };

  deactivatequestion = async (lessonquizquestionid: string) => {
    await this.lessonQuizQuestionService
      .deactivatequizquestion(lessonquizquestionid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Question deactivated sucessfully'
    );
    await this.loadDataFromServer();
  };

  deletequestion = async (lessonquizquestionid: string) => {
    await this.lessonQuizQuestionService
      .deletequizquestion(lessonquizquestionid)
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
      'lessonquizquestionorder'
    )?.value;
    this.invalidOrder = true;
    this.data.filter((e) => {
      if (Number(e.lessonquizquestionorder) === Number(orderValue)) {
        this.invalidOrder = false;
      }
    });
  }
}
