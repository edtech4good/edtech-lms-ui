import { Component, OnInit, ViewChild } from '@angular/core';
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
import { Question } from 'src/app/models/question.model';
import { QuestionDistractor } from 'src/app/models/questiondistractor.model';
import { DropDownService } from 'src/app/services/dropdown.service';
import { UtilService } from 'src/app/services/util.service';
import { countSubstrings } from 'voca';
import { DocumentService } from '../../document/services/document.service';
import { QuestionDistractorComponent } from '../question-distractor/question-distractor.component';
import { QuestionHeadingComponent } from '../question-heading/question-heading.component';
import { QuestionOptionHolderComponent } from '../question-option-holder/question-option-holder.component';
import { QuestionService } from '../services/question.service';

@Component({
  selector: 'app-question-update',
  templateUrl: './question-update.component.html',
  styleUrls: ['./question-update.component.less'],
})
export class QuestionUpdateComponent implements OnInit {
  @ViewChild('questionHeading', { static: true })
  public questionHeading?: QuestionHeadingComponent;
  @ViewChild('questionDistractors')
  public questionDistractors?: QuestionDistractorComponent;
  @ViewChild('questionOptionHolder')
  public questionOptionHolder?: QuestionOptionHolderComponent;

  errorMessages = {
    questiontext: 'Please enter question text!',
    questionfile: 'Please select question file!',
  };
  dataloading = false;
  link: any;
  level:any;
  practice: any;
  public defaultOption: Array<any> = [];
  question?: Question;
  questionForm: FormGroup = this.fb.group({});
  templatetypes: Array<any> = [];
  private questionupdatesearchChange$ = new BehaviorSubject('');
  questionupdateoptionList: string[] = [];
  questionupdateisLoading = false;
  selectedtemplatetype = -1;
  questionupdateonSearch(value: string): void {
    this.questionupdateisLoading = true;
    if ((value || '').trim().length <= 2) {
      return;
    }
    this.questionupdatesearchChange$.next(value);
  }

  constructor(
    private fb: FormBuilder,
    private dropdownService: DropDownService,
    private ut: UtilService,
    private documentService: DocumentService,
    private questionService: QuestionService,
    private route: ActivatedRoute,
    private readonly notification: NzNotificationService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.dataloading = true;
    const questionid = this.route.snapshot.paramMap.get('questionid') ?? '';
    this.questionForm = this.fb.group({
      questionid: [questionid, [Validators.required]],
      templatetypeid: [null, [Validators.required]],
      questiontext: [null, [Validators.minLength(1)]],
      questionfile: [null, [Validators.minLength(1)]],
      questionidentifier: [
        null,
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
        ],
      ],
      questioncorrectvalue: [0, [Validators.required, Validators.min(0)]],
    });
    if ((questionid || '')?.trim().length <= 0) {
      this.notification.create('error', 'error', 'Invalid link');
      this.router.navigate(['question/index']);
      return;
    }
    this.questionService
      .get(questionid)
      .pipe(first())
      .subscribe((tempdata: any) => {
        if (tempdata.error) {
          this.notification.create('error', 'error', 'Invalid link');
          this.router.navigate(['question/index']);
        }
        this.question = tempdata.data;
        if (this.question) {
          this.questionForm
            .get('templatetypeid')
            ?.setValue(this.question.templatetypeid);
          this.questionForm
            .get('questiontext')
            ?.setValue(this.question.questiontext);
          if (this.question.questionfile) {
            this.defaultOption = [
              {
                documentname: this.question.questionfile.filename,
              },
            ];
            this.questionupdateoptionList = [
              this.question.questionfile.filename,
            ];
            this.questionForm
              .get('questionfile')
              ?.setValue(this.question.questionfile.filename);
          }
          this.questionForm
            .get('questionidentifier')
            ?.setValue(this.question.questionidentifier);
          if (this.question.questionheading) {
            this.questionHeading?.setForm(this.question.questionheading);
          }
          if (this.question.questiondistractors) {
            setTimeout(() => {
              if (this.question) {
                this.questionDistractors?.setForm(
                  this.question.questiondistractors || []
                );
              }
            }, 500);
          }
          if (this.question.questionoptions) {
            this.questionOptionHolder?.setForm(this.question.questionoptions);
          }
          this.selectedtemplatetype = this.question.templatetypeid;
          // Add this line to set the questioncorrectvalue
          this.questionForm
            .get('questioncorrectvalue')
            ?.setValue(this.question.questioncorrectvalue);

            this.questionForm.get
        }
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

    this.templatetypes = await this.dropdownService
      .gettemplatetype()
      .pipe(
        catchError(async () => ({ data: [] })),
        map((res: any) => res.data)
      )
      .toPromise();
    const getquestionfile = (filename: string) => {
      let temp = new IPaging();
      temp.pagesize = 20;
      temp.filter = [
        {
          key: 'documentname',
          value: filename || '----',
        },
      ];
      const httpobject = this.documentService
        .getall(temp)
        .pipe(
          catchError(async () => ({ data: { data: [] } })),
          map((res: any) => res.data.data)
        )
        .pipe(map((list: any) => list.map((item: any) => item.documentname)));
      return httpobject;
    };
    const questionupdateoptionList$: Observable<string[]> =
      this.questionupdatesearchChange$
        .asObservable()
        .pipe(debounceTime(500))
        .pipe(switchMap(getquestionfile));
    questionupdateoptionList$.subscribe((data) => {
      this.defaultOption = [];
      this.questionupdateoptionList = data;
      this.questionupdateisLoading = false;
    });
  }
  modelvalueCheck = ($event: number) => {
    this.selectedtemplatetype = $event;
    if ($event === 8) {
      this.questionForm.controls['questiontext'].setValidators([
        Validators.minLength(1),
        Validators.required,
      ]);
      this.questionForm.controls['questionfile'].enable();
    } else {
      this.questionForm.controls['questiontext'].setValidators([
        Validators.minLength(1),
      ]);
      this.questionForm.controls['questionfile'].enable();
    }
  };

  questionupdateonSubmit = async () => {
    this.route.params.subscribe((params) => {
      this.link = params.link;
      this.practice = params.practice;
      this.level = params.level;
      // console.log('practice',params.practice);
      // console.log('link',params.link);
      // console.log('level',params.level);

    });

    let tempquestion: Question | null = this.getFormValue();
    if (tempquestion) {
      tempquestion = { ...this.question, ...tempquestion };
      //form valid proceed
      await this.questionService.update(tempquestion).pipe(first()).toPromise();
      this.notification.create(
        'success',
        'Success',
        'Question updated sucessfully'
      );
      if (this.practice === undefined && this.link !== undefined && this.level === undefined) {
        this.router.navigate(['/lesson/quiz/question/' + this.link]);
      } else if (this.link === undefined && this.level === undefined && this.practice !== undefined) {
        this.router.navigate(['/lesson/practice/question/' + this.practice]);
      } else if (this.level !== undefined && this.link === undefined && this.practice === undefined) {
        this.router.navigate(['/level/quiz/' + this.level]);
      }
      else {
        this.router.navigate(['question/index']);
      }
    } else {
      return;
    }
  };

  validateForm = (): boolean => {
    let valid = true;
    this.ut.checkFormDirty(this.questionForm);
    if (this.questionForm.valid) {
      if (this.selectedtemplatetype === 8) {
        const componentvalue: string =
          this.questionForm.controls['questiontext']?.value || '';
        if (componentvalue.indexOf('-----') < 0) {
          this.questionForm.controls['questiontext'].setErrors({
            required: true,
          });
          this.errorMessages = {
            ...this.errorMessages,
            questiontext:
              'Question text must contain atleast one fill in the blank template(-----)!',
          };
          valid = false;
        } else {
          this.questionForm.controls['questiontext'].setErrors(null);
          this.errorMessages = {
            questiontext: 'Please enter question text!',
            questionfile: 'Please select question file!',
          };
        }
      }
    }
    return valid;
  };
  getFormValue = (): Question | null => {
    let tempquestion: Question | null = null;
    if (this.validateForm()) {
      let tempquestionForm: any = { ...this.questionForm.value };
      if (tempquestionForm.questionfile) {
        tempquestionForm.questionfile = this.ut.filemetaextractor(
          tempquestionForm.questionfile
        );
      }
      tempquestion = new Question();
      tempquestion = {
        ...tempquestion,
        ...tempquestionForm,
      };
      if (tempquestion) {
        if (this.questionHeading) {
          let tempquestionHeading = this.questionHeading.getFormValue();
          if (!tempquestionHeading) {
            return null;
          } else {
            tempquestion = {
              ...tempquestion,
              questionheading: { ...tempquestionHeading },
              questioncorrectvalue: this.questionForm.controls['questioncorrectvalue']?.value || 0
            };
          }
        }

        if (this.selectedtemplatetype === 8) {
          let tempDistractors: Array<QuestionDistractor> | null = null;
          tempDistractors = this.questionDistractors?.getFormValue() || null;
          if (!tempDistractors) {
            return null;
          } else {
            tempquestion = {
              ...tempquestion,
              questiondistractors: [...tempDistractors],
            };
          }
        }
        let tempOptions = this.questionOptionHolder?.getFormValue();
        if (!tempOptions) {
          return null;
        } else {
          //check for fill in the blanks
          if (this.selectedtemplatetype === 8) {
            if (
              countSubstrings(tempquestion.questiontext, '-----') !==
              tempOptions.length
            ) {
              this.questionForm.controls['questiontext'].setErrors({
                required: true,
              });
              this.errorMessages = {
                ...this.errorMessages,
                questiontext:
                  'fill in the blank templates and options count must match !',
              };
              return null;
            } else {
              this.questionForm.controls['questiontext'].setErrors(null);
              this.errorMessages = {
                questiontext: 'Please enter question text!',
                questionfile: 'Please select question file!',
              };
            }
          }

          //form valid proceed
          tempquestion = {
            ...tempquestion,
            questionoptions: [...tempOptions],
          };
        }
      }
    }
    return tempquestion;
  };
}
