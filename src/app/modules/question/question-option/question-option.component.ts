import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, debounceTime, map, switchMap } from 'rxjs/operators';
import { IPaging } from 'src/app/models/IPaging';
import { QuestionOption } from 'src/app/models/questionoption.model';
import { UtilService } from 'src/app/services/util.service';
import { DocumentService } from '../../document/services/document.service';
import { QuestionAssociateComponent } from '../question-associate/question-associate.component';
@Component({
  selector: 'app-question-option',
  templateUrl: './question-option.component.html',
  styleUrls: ['./question-option.component.less'],
})
export class QuestionOptionComponent implements OnInit {
  @ViewChild('questionAssociate')
  public questionAssociate?: QuestionAssociateComponent;
  public questionOptionForm!: UntypedFormGroup;
  public defaultOption: Array<any> = [];
  @Input()
  optionIndex: number = 0;
  _templateType: number = 0;
  get templateType(): number {
    return this._templateType;
  }
  @Input() set templateType(value: number) {
    this._templateType = value;
  }

  private optionsearchChange$ = new BehaviorSubject('');
  optionoptionList: any[] = [];
  optionisLoading = false;
  errorMessages = {
    questionoptiondefault: 'Please enter correct value',
    optionassociatetext: 'Please enter associate text!',
    questionoptiontext: 'Please enter option text!',
    questionoptionvalue: 'Please enter option value!',
    optionassociatefile:
      'Please select option associate file! (Enter Minimum 4 characters to search)',
    questionoptionfile:
      'Please select option file! (Enter Minimum 4 characters to search)',
    questionoptioniscorrect: 'Please select atleast one correct option',
  };

  optiononSearch(value: string): void {
    this.optionisLoading = true;
    if ((value || '').trim().length <= 2) {
      return;
    }
    this.optionsearchChange$.next(value);
  }

  constructor(
    private fb: UntypedFormBuilder,
    private documentService: DocumentService,
    private utilService: UtilService
  ) {}

  ngOnInit(): void {
    this.questionOptionForm = this.fb.group({
      questionoptiontext: [null, [Validators.minLength(1)]],
      questionoptionfile: [null, [Validators.minLength(1)]],
      optionassociatefile: [null, [Validators.minLength(1)]],
      optionassociatetext: [null, [Validators.minLength(1)]],
      questionoptionisstaticfile: [false, []],
      questionoptionvalue: [null, [Validators.minLength(1)]],
      questionoptionnumeratorvalue: [null, [Validators.minLength(1)]],
      questionoptionnumeratorisstatic: [false, []],
      questionoptiondenominatorvalue: [null, [Validators.minLength(1)]],
      questionoptiondenominatorisstatic: [false, []],
      questionoptionisfraction: [false, []],
      questionoptionistext: [false, []],
      questionoptioniscorrect: [false, []],
      questionoptionid: [null, []],
    });
    const getoption = (filename: string) => {
      let temp = new IPaging();
      temp.pagesize = 20;
      temp.filter = [
        {
          key: 'documenttags',
          value: filename || '----',
        },
      ];
      if ([1, 3, 9, 10, 13].includes(this.templateType)) {
        temp.filter.push({
          key: 'documenttypeid',
          value: '1',
        });
      }
      if ([2, 4, 6, 12, 15, 16].includes(this.templateType)) {
        temp.filter.push({
          key: 'documenttypeid',
          value: '6',
        });
      }
      const httpobject = this.documentService.getall(temp).pipe(
        catchError(async () => ({ data: { data: [] } })),
        map((res: any) => res.data.data)
      );
      return httpobject;
    };
    const optionoptionList$: Observable<string[]> = this.optionsearchChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(getoption));
    optionoptionList$.subscribe((data) => {
      this.defaultOption = [];
      this.optionoptionList = data;
      this.optionisLoading = false;
    });
  }
  validateForm = (): boolean => {
    let valid = true;
    this.utilService.checkFormDirty(this.questionOptionForm);
    if (this.questionOptionForm.valid) {
      if (
        (!this.questionOptionForm.controls['questionoptiontext']?.value ||
          this.questionOptionForm.controls['questionoptiontext'].value.trim()
            .length <= 0) &&
        (!this.questionOptionForm.controls['optionassociatetext']?.value ||
          this.questionOptionForm.controls['optionassociatetext'].value.trim()
            .length <= 0) &&
        (!this.questionOptionForm.controls['questionoptionfile']?.value ||
          this.questionOptionForm.controls['questionoptionfile'].value.trim()
            .length <= 0) &&
        (!this.questionOptionForm.controls['optionassociatefile']?.value ||
          this.questionOptionForm.controls['optionassociatefile'].value.trim()
            .length <= 0)
      ) {
        this.questionOptionForm.controls['questionoptiontext'].setErrors({
          required: true,
        });
        this.questionOptionForm.controls['questionoptionfile'].setErrors({
          required: true,
        });
        this.questionOptionForm.controls['optionassociatefile'].setErrors({
          required: true,
        });
        this.questionOptionForm.controls['optionassociatetext'].setErrors({
          required: true,
        });
        this.errorMessages = {
          questionoptiondefault: 'Please enter correct value',
          optionassociatetext: 'Please enter associate text!',
          questionoptionvalue: 'Please enter option value!',
          questionoptiontext: 'Option text is required!',
          optionassociatefile: 'Option associate file is required!',
          questionoptionfile: 'Option file is required!',
          questionoptioniscorrect: 'Please select atleast one correct option',
        };
        valid = false;
        return valid;
      } else {
        this.questionOptionForm.controls['questionoptiontext'].setErrors(null);
        this.questionOptionForm.controls['optionassociatetext'].setErrors(null);
        this.questionOptionForm.controls['optionassociatefile'].setErrors(null);
        this.questionOptionForm.controls['optionassociatefile'].setErrors(null);
        this.errorMessages = {
          optionassociatetext: 'Please enter associate text!',
          questionoptiontext: 'Please enter option text!',
          questionoptiondefault: 'Please enter correct value',
          questionoptionvalue: 'Please enter option value!',
          optionassociatefile:
            'Please select option associate file! (Enter Minimum 4 characters to search)!',
          questionoptionfile:
            'Please select option file! (Enter Minimum 4 characters to search)',
          questionoptioniscorrect: 'Please select atleast one correct option',
        };
      }
    }

    if (
      (this.templateType === 1 || this.templateType === 3) &&
      this.questionOptionForm.controls['questionoptiontext']?.value?.length >
        100
    ) {
      this.questionOptionForm.controls['questionoptiontext'].setErrors({
        required: true,
      });
      this.errorMessages.questionoptiontext =
        'Option text must not exceed 100 characters';
      valid = false;
      return valid;
    } else {
      this.questionOptionForm.controls['questionoptiontext'].setErrors(null);
    }

    if (
      (this.templateType === 2 || this.templateType === 4) &&
      (!this.questionOptionForm.controls['questionoptionfile'] ||
        (
          this.questionOptionForm.controls['questionoptionfile'].value || ''
        ).trim().length <= 0)
    ) {
      this.questionOptionForm.controls['questionoptionfile'].setErrors({
        required: true,
      });
      this.errorMessages.questionoptionfile = 'Option file is required!';
      valid = false;
      return valid;
    } else {
      this.questionOptionForm.controls['questionoptionfile'].setErrors(null);
    }
    if (
      this.templateType === 6 &&
      (!this.questionOptionForm.controls['questionoptionfile'] ||
        (
          this.questionOptionForm.controls['questionoptionfile'].value || ''
        ).trim().length <= 0)
    ) {
      this.questionOptionForm.controls['questionoptionfile'].setErrors({
        required: true,
      });
      this.errorMessages.questionoptionfile = 'Option file is required!';
      valid = false;
      return valid;
    } else {
      this.questionOptionForm.controls['questionoptionfile'].setErrors(null);
    }

    if (
      [1, 10, 11, 12, 13, 14, 15, 16, 17].includes(this.templateType) &&
      (!this.questionOptionForm.controls['questionoptiontext'] ||
        (
          this.questionOptionForm.controls['questionoptiontext'].value || ''
        ).trim().length <= 0) &&
      (!this.questionOptionForm.controls['questionoptionfile'] ||
        (
          this.questionOptionForm.controls['questionoptionfile'].value || ''
        ).trim().length <= 0)
    ) {
      this.questionOptionForm.controls['questionoptiontext'].setErrors({
        required: true,
      });
      this.errorMessages.questionoptionfile = 'Option text is required!';

      this.questionOptionForm.controls['questionoptionfile'].setErrors({
        required: true,
      });
      this.errorMessages.questionoptionfile = 'Option file is required!';

      valid = false;
      return valid;
    } else {
      this.questionOptionForm.controls['questionoptiontext'].setErrors(null);
      this.questionOptionForm.controls['questionoptionfile'].setErrors(null);
    }

    if (
      [10, 11, 12, 13, 14, 15, 16, 17].includes(this.templateType) &&
      (!this.questionOptionForm.controls['optionassociatetext'] ||
        (
          this.questionOptionForm.controls['optionassociatetext'].value || ''
        ).trim().length <= 0) &&
      (!this.questionOptionForm.controls['optionassociatefile'] ||
        (
          this.questionOptionForm.controls['optionassociatefile'].value || ''
        ).trim().length <= 0)
    ) {
      this.questionOptionForm.controls['optionassociatetext'].setErrors({
        required: true,
      });
      this.errorMessages.questionoptionfile = 'Option text is required!';

      this.questionOptionForm.controls['optionassociatefile'].setErrors({
        required: true,
      });
      this.errorMessages.questionoptionfile = 'Option file is required!';

      valid = false;
      return valid;
    } else {
      this.questionOptionForm.controls['optionassociatetext'].setErrors(null);
      this.questionOptionForm.controls['optionassociatefile'].setErrors(null);
    }

    if (this.templateType === 9) {
      if (
        !this.questionOptionForm.controls['questionoptiontext'] ||
        (
          this.questionOptionForm.controls['questionoptiontext'].value || ''
        ).trim().length <= 0
      ) {
        this.questionOptionForm.controls['questionoptiontext'].setErrors({
          required: true,
        });
        this.errorMessages.questionoptionfile = 'Option text is required!';
        valid = false;
        return valid;
      } else if (
        !this.questionOptionForm.controls['questionoptionfile'] ||
        (
          this.questionOptionForm.controls['questionoptionfile'].value || ''
        ).trim().length <= 0
      ) {
        this.questionOptionForm.controls['questionoptionfile'].setErrors({
          required: true,
        });
        this.errorMessages.questionoptionfile = 'Option file is required!';
        valid = false;
        return valid;
      } else if (
        !this.questionOptionForm.controls['optionassociatefile'] ||
        (
          this.questionOptionForm.controls['optionassociatefile'].value || ''
        ).trim().length <= 0
      ) {
        this.questionOptionForm.controls['optionassociatefile'].setErrors({
          required: true,
        });
        this.errorMessages.questionoptionfile =
          'Option associate file is required!';
        valid = false;
        return valid;
      } else {
        this.questionOptionForm.controls['questionoptiontext'].setErrors(null);
        this.questionOptionForm.controls['questionoptionfile'].setErrors(null);
        this.questionOptionForm.controls['optionassociatefile'].setErrors(null);
      }
    }

    if (this.templateType == 7) {
      let tempAssociate = this.questionAssociate?.getFormValue();
      if (!tempAssociate) {
        valid = false;
        return valid;
      }
    }
    return valid;
  };
  getFormValue = (): QuestionOption | null => {
    if (this.validateForm()) {
      let tempquestionOptionForm: any = { ...this.questionOptionForm.value };
      if (tempquestionOptionForm.questionoptionfile) {
        tempquestionOptionForm.questionoptionfile =
          this.utilService.filemetaextractor(
            tempquestionOptionForm.questionoptionfile
          );
      }
      return {
        ...tempquestionOptionForm,
        questionoptionsequence: this.optionIndex,
        questionassociate:
          this.templateType == 7
            ? this.questionAssociate?.getFormValue()
            : null,
      };
    } else {
      return null;
    }
  };

  setForm = (data: QuestionOption) => {
    if(data.questionoptionvalue){
      this.questionOptionForm.get('questionoptionvalue')
      ?.setValue(data.questionoptionvalue);
    }
    if(data.questionoptionisstaticfile){
      this.questionOptionForm.get('questionoptionisstaticfile')
      ?.setValue(data.questionoptionisstaticfile);
    }
    if(data.questionoptionnumeratorvalue) {
      this.questionOptionForm.get('questionoptionnumeratorvalue')
      ?.setValue(data.questionoptionnumeratorvalue);
    }
    if(data.questionoptionnumeratorisstatic) {
      this.questionOptionForm.get('questionoptionnumeratorisstatic')
      ?.setValue(data.questionoptionnumeratorisstatic);
    }
    if(data.questionoptiondenominatorvalue) {
      this.questionOptionForm.get('questionoptiondenominatorvalue')
      ?.setValue(data.questionoptiondenominatorvalue);
    }
    if(data.questionoptiondenominatorisstatic) {
      this.questionOptionForm.get('questionoptiondenominatorisstatic')
      ?.setValue(data.questionoptiondenominatorisstatic);
    }
    if(data.questionoptionisfraction) {
      this.questionOptionForm.get('questionoptionisfraction')
      ?.setValue(data.questionoptionisfraction);
    }
    if(data.questionoptionistext) {
      this.questionOptionForm.get('questionoptionistext')
      ?.setValue(data.questionoptionistext);
    }
    if (data.questionoptiontext) {
      this.questionOptionForm
        .get('questionoptiontext')
        ?.setValue(data.questionoptiontext);
    }
    if (data.questionoptionfile) {
      this.defaultOption = [
        {
          documentname: data.questionoptionfile.filename,
        },
      ];
      this.optionoptionList = [data.questionoptionfile.filename];
      this.questionOptionForm
        .get('questionoptionfile')
        ?.setValue(data.questionoptionfile.filename);
    }
    if (data.optionassociatetext) {
      this.questionOptionForm
        .get('optionassociatetext')
        ?.setValue(data.optionassociatetext);
    }
    if (data.optionassociatefile) {
      this.defaultOption = [
        ...this.defaultOption,{
          documentname: data.optionassociatefile,
        },
      ];
      this.optionoptionList = [data.optionassociatefile];
      this.questionOptionForm
        .get('optionassociatefile')
        ?.setValue(data.optionassociatefile);
    }
    this.questionOptionForm
      .get('questionoptioniscorrect')
      ?.setValue(data.questionoptioniscorrect);
    if (data.questionassociate) {
      this.questionAssociate?.setForm(data.questionassociate);
    }
    this.questionOptionForm
      .get('questionoptionid')
      ?.setValue(data.questionoptionid);
  };
  triggerisCorrectError = (error: boolean) => {
    this.questionOptionForm.controls['questionoptioniscorrect'].setErrors(
      error ? { required: true } : null
    );
  };

  triggerquestionoptiontextError = (
    error: boolean,
    errorMessage: string = 'Please enter option text!'
  ) => {
    this.errorMessages.questionoptiontext = errorMessage;
    this.questionOptionForm.controls['questionoptiontext'].setErrors(
      error ? { required: true } : null
    );
  };
}
