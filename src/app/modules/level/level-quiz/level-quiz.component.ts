import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
import { LevelQuizQuestionService } from 'src/app/services/level.quiz.question.service';
import { UtilService } from 'src/app/services/util.service';
import { QuestionService } from '../../question/services/question.service';
import { LessonService } from 'src/app/services/lesson.service';

@Component({
  selector: 'app-level-quiz',
  templateUrl: './level-quiz.component.html',
  styleUrls: ['./level-quiz.component.less'],
})
export class LevelQuizComponent implements OnInit {
  dataloading = false;
  invalidOrder = true;
  level: any;
  data: Array<any> = [];
  createForm!: UntypedFormGroup;
  bindLessonForm!: UntypedFormGroup;
  questionoptionList: any[] = [];
  showModalAddQuestion = false;
  private questionsearchChange$ = new BehaviorSubject('');
  questionisLoading = false;
  showModalBindLesson = false;
  selectedlevelquizquestionid = '';
  async loadDataFromServer() {
    this.dataloading = true;
    const levelid = this.route.snapshot.paramMap.get('levelid') ?? '';
    this.level = this.route.snapshot.paramMap.get('levelid') ?? '';
    const tempdata: any = await
    this.levelquizquestion
      .getquizquestion(levelid)
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

  async handleModalAddQuestion() {
    const levelid = this.route.snapshot.paramMap.get('levelid') ?? '';
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid && this.invalidOrder) {
      await this.levelquizquestion
        .addquizquestion(
          levelid,
          this.createForm.getRawValue()['questionid'],
          this.createForm.getRawValue()['levelquizquestionorder']
        )
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'Question added successfully'
      );
      await this.loadDataFromServer();
      this.showModalAddQuestion = false;
    } else {
      if (this.createForm.get('levelquizquestionorder')?.value !== null) {
        this.notification.create('error', 'error', 'Duplicate order number');
      }
    }
  }

  constructor(
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    private utilservice: UtilService,
    private readonly notification: NzNotificationService,
    private questionService: QuestionService,
    private levelquizquestion: LevelQuizQuestionService,
    private lessonService: LessonService,
  ) {}

  async ngOnInit() {
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
    this.setupSearchLesson();
  }
  showModelAddQuestion = () => {
    this.createForm = this.fb.group({
      questionid: [null, [Validators.required]],
      levelquizquestionorder: [
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
    await this.levelquizquestion
      .reorderquizquestion(
        old.levelquizquestionid,
        newdata.levelquizquestionorder
      )
      .pipe(first())
      .toPromise();
    await this.levelquizquestion
      .reorderquizquestion(
        newdata.levelquizquestionid,
        old.levelquizquestionorder
      )
      .pipe(first())
      .toPromise();
    await this.loadDataFromServer();
  };

  activatequestion = async (levelquizquestionid: string) => {
    await this.levelquizquestion
      .activatequizquestion(levelquizquestionid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Question activated sucessfully'
    );
    await this.loadDataFromServer();
  };

  deactivatequestion = async (levelquizquestionid: string) => {
    await this.levelquizquestion
      .deactivatequizquestion(levelquizquestionid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Question deactivated sucessfully'
    );
    await this.loadDataFromServer();
  };

  deletequestion = async (levelquizquestionid: string) => {
    await this.levelquizquestion
      .deletequizquestion(levelquizquestionid)
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
    const orderValue = this.createForm.get('levelquizquestionorder')?.value;
    this.invalidOrder = true;
    this.data.filter((e) => {
      if (Number(e.levelquizquestionorder) === Number(orderValue)) {
        this.invalidOrder = false;
      }
    });
  }

  showModelBindLesson = (levelquizquestionid: string, lessonid: string) => {
    this.bindLessonForm = this.fb.group({
      lessonid: [null, [Validators.required]],
    });
    this.bindLessonForm
      .get('lessonid')
      ?.setValue(lessonid);
    this.showModalBindLesson = true;
    this.selectedlevelquizquestionid = levelquizquestionid;
  };

  async handleModalBindLesson() {
    this.utilservice.checkFormDirty(this.bindLessonForm);
    if (this.bindLessonForm.valid) {
      await this.levelquizquestion
        .setlesson(
          this.selectedlevelquizquestionid,
          this.bindLessonForm.getRawValue()['lessonid'],
        )
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'Set lesson to question successfully'
      );
      await this.loadDataFromServer();
      this.showModalBindLesson = false;
    } else {
      this.notification.create('error', 'error', 'Invalid Form');
    }
  }

  hideModalBindLesson = () => {
    this.showModalBindLesson = false;
  };

  // search lesson
  searchLessonChange$ = new BehaviorSubject({
    lessonname: 'string',
    levelid: 'string',
  });
  lessonList: any[] = [];
  isLessonLoading = false;

  setupSearchLesson() {
    const lessonList$: Observable<string[]> = this.searchLessonChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getLessonList));
    lessonList$.subscribe((data) => {
      this.lessonList = data;
      this.isLessonLoading = false;
    });
  }

  onSearchLesson(value: string): void {
    this.isLessonLoading = true;
    this.searchLessonChange$.next({
      lessonname: value,
      levelid: this.route.snapshot.paramMap.get('levelid') ?? '',
    });
  }

  getLessonList = (search: {
    lessonname: string;
    levelid: string;
  }): Observable<any> =>
    this.lessonService
      .getAllLessons(search.lessonname, search.levelid)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );
}
