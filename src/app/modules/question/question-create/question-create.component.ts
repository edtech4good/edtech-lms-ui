import { Component, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
import { QuestionTagService } from 'src/app/services/question-tag.service';
import { UtilService } from 'src/app/services/util.service';
import { v4 } from 'uuid';
import { countSubstrings } from 'voca';
import { DocumentService } from '../../document/services/document.service';
import { QuestionDistractorComponent } from '../question-distractor/question-distractor.component';
import { QuestionHeadingComponent } from '../question-heading/question-heading.component';
import { QuestionOptionHolderComponent } from '../question-option-holder/question-option-holder.component';
import { QuestionService } from '../services/question.service';
import { QuestionHeading } from '../../../models/questionheading.model';

@Component({
  selector: 'app-question-create',
  templateUrl: './question-create.component.html',
  styleUrls: ['./question-create.component.less'],
})
export class QuestionCreateComponent implements OnInit {
  @ViewChild('questionHeading', { static: true })
  public questionHeading?: QuestionHeadingComponent;
  @ViewChild('questionDistractors')
  public questionDistractors?: QuestionDistractorComponent;
  @ViewChild('questionOptionHolder')
  public questionOptionHolder?: QuestionOptionHolderComponent;

  dataloading = false;
  errorMessages = {
    questiontext: 'Please enter question text!',
    questionfile: 'Please select question file!',
  };
  questionForm: UntypedFormGroup = this.fb.group({});
  onlyMP3 = false;
  templatetypes: Array<any> = [];
  private questioncreatesearchChange$ = new BehaviorSubject('');
  questioncreateoptionList: any[] = [];
  questioncreateisLoading = false;
  selectedtemplatetype = -1;
  questiontags: Array<any> = [];
  questioncreateonSearch(value: string): void {
    this.questioncreateisLoading = true;
    if ((value || '').trim().length <= 2) {
      return;
    }
    this.questioncreatesearchChange$.next(value);

  }

  constructor(
    private fb: UntypedFormBuilder,
    private dropdownService: DropDownService,
    private ut: UtilService,
    private documentService: DocumentService,
    private questionService: QuestionService,
    private dts: QuestionTagService,
    private router: Router,
    private readonly notification: NzNotificationService
  ) {}

  async ngOnInit() {
    this.dataloading = true;
    this.questionForm = this.fb.group({
      templatetypeid: [null, [Validators.required]],
      questiontext: [null, [Validators.minLength(1)]],
      questionfile: [null, [Validators.minLength(1)]],
      questiontags: [null, [Validators.minLength(1)]],
      questionidentifier: [
        null,
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
          // Validators.pattern('^[a-zA-Z0-9]+$'),
        ],
      ],
      questioncorrectvalue: [0, [Validators.required, Validators.min(0)]],
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
      );
      return httpobject;
    };
    const questioncreateoptionList$: Observable<string[]> =
      this.questioncreatesearchChange$
        .asObservable()
        .pipe(debounceTime(500))
        .pipe(switchMap(getquestionfile));
    questioncreateoptionList$.subscribe((data) => {
      let ftd = data.filter((e: any) => {
        return e.documentname.includes('.mp3');
      });
      if (this.onlyMP3) {
        this.questioncreateoptionList = ftd;
        this.questioncreateisLoading = false;
      } else {
        this.questioncreateoptionList = data;
        this.questioncreateisLoading = false;
      }
    });
    // this.questiontags = await
    this.dts
      .getall(new IPaging())
      .pipe(
        catchError(async () => ({ data: { data: [] } })),
        // map((res: any) => res.data.data)
      )
      .subscribe(
        (res: any) => {
          this.questiontags = res.data.data;
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
  }
  modelvalueCheck = ($event: number) => {
    this.selectedtemplatetype = $event;
    if ($event === 8) {
      this.questionForm.controls['questiontext'].setValidators([
        Validators.minLength(1),
        Validators.required,
      ]);
      this.questionForm.controls['questionfile'].enable();
    } else if ($event == 2) {
      this.onlyMP3 = false;
    } else if ($event == 4) {
      this.onlyMP3 = false;
    } else if ($event == 6) {
      this.onlyMP3 = false;
      this.questionForm.controls['questionfile'].disable();
    } else if ($event == 7) {
      this.onlyMP3 = false;
      this.questionForm.controls['questionfile'].disable();
    } else {
      this.questionForm.controls['questiontext'].setValidators([
        Validators.minLength(1),
      ]);
      this.questionForm.controls['questionfile'].enable();
    }
  };

  questioncreateonSubmit = async () => {
    let tempquestion: Question | null = this.getFormValue();
    if (tempquestion) {
      //form valid proceed
      await this.questionService.create(tempquestion).pipe(first()).toPromise();
      this.notification.create(
        'success',
        'Success',
        'Question created successfully'
      );
      this.router.navigate(['question/index']);
    } else {
      return;
    }
  };

  validateForm = (): boolean => {
    let valid = true;
    this.ut.checkFormDirty(this.questionForm);
    const qq = this.questionForm.controls['questiontags'].value;
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
      tempquestion.questiontags =
        this.questionForm.controls['questiontags'].value;
      tempquestion = {
        ...tempquestion,
        questionid: v4(),
        ...tempquestionForm,
        questioncorrectvalue: this.questionForm.controls['questioncorrectvalue']?.value
      };
      if (tempquestion) {
        if (this.questionHeading) {
          let tempquestionHeading = this.questionHeading.getFormValue();
          if (!tempquestionHeading || this.questionHeading.questionHeadingForm.controls['headingtext'].value === null) {
          this.questionHeading.questionHeadingForm.controls['headingtext'].setErrors({
            require: true,
          })
            return null;
          } else {
            console.log(this.questionHeading.questionHeadingForm.controls['headingtext'].value)
            tempquestion = {
              ...tempquestion,
              questionheading: { ...tempquestionHeading },
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
