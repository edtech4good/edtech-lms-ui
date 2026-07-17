import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, debounceTime, map, switchMap } from 'rxjs/operators';
import { IPaging } from 'src/app/models/IPaging';
import { QuestionAssociate } from 'src/app/models/questionassociate.model';
import { UtilService } from 'src/app/services/util.service';
import { v4 } from 'uuid';
import { DocumentService } from '../../document/services/document.service';

@Component({
    selector: 'app-question-associate',
    templateUrl: './question-associate.component.html',
    styleUrls: ['./question-associate.component.less'],
    standalone: false
})
export class QuestionAssociateComponent implements OnInit {
  public questionAssociateForm!: UntypedFormGroup;
  private associatesearchChange$ = new BehaviorSubject('');
  public defaultOption: Array<any> = [];
  associateassociateList: any[] = [];
  associateisLoading = false;
  errorMessages = {
    questionassociatetext: 'Please enter associate text!',
    questionassociatefile: 'Please select associate file!',
  };
  associateonSearch(value: string): void {
    this.associateisLoading = true;
    if ((value || '').trim().length <= 2) {
      return;
    }
    this.associatesearchChange$.next(value);
  }

  validateForm = (): boolean => {
    let valid = true;
    let tempdata: Array<string> = [];
    this.utilService.checkFormDirty(this.questionAssociateForm);
    if (this.questionAssociateForm.valid) {
      if (
        (!this.questionAssociateForm.controls['questionassociatetext']?.value ||
          this.questionAssociateForm.controls[
            'questionassociatetext'
          ].value.trim().length <= 0) &&
        (!this.questionAssociateForm.controls['questionassociatefile']?.value ||
          this.questionAssociateForm.controls[
            'questionassociatefile'
          ].value.trim().length <= 0)
      ) {
        this.questionAssociateForm.controls['questionassociatetext'].setErrors({
          required: true,
        });
        this.questionAssociateForm.controls['questionassociatefile'].setErrors({
          required: true,
        });
        this.errorMessages = {
          questionassociatetext: 'Associate text or file is required!',
          questionassociatefile: 'Associate text or file is required!',
        };
        valid = false;
      }
      // if (
      //   this.questionAssociateForm.controls[
      //     'questionassociatetext'
      //   ].value?.trim().length >= 15
      // ) {
      //   this.questionAssociateForm.controls['questionassociatetext'].setErrors({
      //     required: true,
      //   });
      //   this.errorMessages = {
      //     questionassociatetext:
      //       'Associate text combined must not exceed 15 characters',
      //     questionassociatefile: ' ',
      //   };
      //   valid = false;
      // // } else {
      //   this.questionAssociateForm.controls['questionassociatetext'].setErrors(
      //     null
      //   );
      //   this.questionAssociateForm.controls['questionassociatefile'].setErrors(
      //     null
      //   );
      //   this.errorMessages = {
      //     questionassociatetext: 'Please enter associate text!',
      //     questionassociatefile: 'Please select associate file!',
      //   };
      // }
    }
    return valid;
  };
  getFormValue = (): QuestionAssociate | null => {
    if (this.validateForm()) {
      let tempquestionAssociateForm: any = {
        ...this.questionAssociateForm.value,
      };
      if (tempquestionAssociateForm.questionassociatefile) {
        tempquestionAssociateForm.questionassociatefile =
          this.utilService.filemetaextractor(
            tempquestionAssociateForm.questionassociatefile
          );
      }
      return { ...tempquestionAssociateForm };
    } else {
      return null;
    }
  };
  constructor(
    private fb: UntypedFormBuilder,
    private documentService: DocumentService,
    private utilService: UtilService
  ) {}

  setForm = (data: QuestionAssociate) => {
    if (data.questionassociatetext) {
      this.questionAssociateForm
        .get('questionassociatetext')
        ?.setValue(data.questionassociatetext);
    }
    if (data.questionassociatefile) {
      this.defaultOption = [
        {
          documentname: data.questionassociatefile.filename,
        },
      ];

      this.associateassociateList = [data.questionassociatefile.filename];
      this.questionAssociateForm
        .get('questionassociatefile')
        ?.setValue(data.questionassociatefile.filename);
    }
    this.questionAssociateForm
      .get('questionoptionid')
      ?.setValue(data.questionoptionid);
  };
  ngOnInit(): void {
    this.questionAssociateForm = this.fb.group({
      questionassociatetext: [null, [Validators.minLength(1)]],
      questionassociatefile: [null, [Validators.minLength(1)]],
      questionoptionid: [v4(), [Validators.minLength(1)]],
    });
    const getassociate = (filename: string) => {
      let temp = new IPaging();
      temp.pagesize = 20;
      temp.filter = [
        {
          key: 'documenttags',
          value: filename || '----',
        },
      ];
      const httpobject = this.documentService.getall(temp).pipe(
        catchError(async () => ({ data: { data: [] } })),
        map((res: any) => res.data.data)
      );
      return httpobject;
    };
    const associateassociateList$: Observable<string[]> =
      this.associatesearchChange$
        .asObservable()
        .pipe(debounceTime(500))
        .pipe(switchMap(getassociate));
    associateassociateList$.subscribe((data) => {
      this.defaultOption = [];
      this.associateassociateList = data;
      this.associateisLoading = false;
    });
  }
}
