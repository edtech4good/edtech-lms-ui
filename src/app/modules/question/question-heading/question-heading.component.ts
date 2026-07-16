import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, debounceTime, map, switchMap } from 'rxjs/operators';
import { IPaging } from 'src/app/models/IPaging';
import { QuestionHeading } from 'src/app/models/questionheading.model';
import { UtilService } from 'src/app/services/util.service';
import { DocumentService } from '../../document/services/document.service';

@Component({
  selector: 'app-question-heading',
  templateUrl: './question-heading.component.html',
  styleUrls: ['./question-heading.component.less'],
})
export class QuestionHeadingComponent implements OnInit {
  public defaultOption: Array<any> = [];
  public questionHeadingForm!: UntypedFormGroup;
  private headingfilesearchChange$ = new BehaviorSubject('');
  headingfileoptionList: any[] = [];
  headingfileisLoading = false;

  headingfileonSearch(value: string): void {
    this.headingfileisLoading = true;
    if ((value || '').trim().length <= 2) {
      return;
    }
    this.headingfilesearchChange$.next(value);
  }

  errorMessages = {
    headingtext: 'Please enter heading text!',
    headingfile:
      'Please select heading file! (Enter Minimum 4 characters to search)',
  };

  constructor(
    private fb: UntypedFormBuilder,
    private documentService: DocumentService,
    private utilService: UtilService
  ) {}

  ngOnInit(): void {
    this.questionHeadingForm = this.fb.group({
      headingtext: [null, [Validators.minLength(1), Validators.required]],
      headingfile: [null, [Validators.minLength(1)]],
    });
    const getheadingfile = (filename: string) => {
      let temp = new IPaging();
      temp.pagesize = 20;
      temp.filter = [
        {
          key: 'documentname',
          value: filename || '----',
        },
        {
          key: 'documenttypeid',
          value: '1',
        },
      ];
      const httpobject = this.documentService.getall(temp).pipe(
        catchError(async () => ({ data: { data: [] } })),
        map((res: any) => res.data.data)
      );
      return httpobject;
    };
    const headingfileoptionList$: Observable<string[]> =
      this.headingfilesearchChange$
        .asObservable()
        .pipe(debounceTime(500))
        .pipe(switchMap(getheadingfile));
    headingfileoptionList$.subscribe((data) => {
      this.defaultOption = [];
      this.headingfileoptionList = data;
      this.headingfileisLoading = false;
    });
  }

  setForm = (data: QuestionHeading) => {
      this.questionHeadingForm.get('headingtext')?.setValue(data.headingtext);
    if (data.headingfile) {
      this.defaultOption = [
        {
          documentname: data.headingfile.filename,
        },
      ];
      this.headingfileoptionList = [data.headingfile.filename];
      this.questionHeadingForm
        .get('headingfile')
        ?.setValue(data.headingfile.filename);
    }
  };

  validateForm = (): boolean => {
    let valid = true;
    this.utilService.checkFormDirty(this.questionHeadingForm);
    if (this.questionHeadingForm.valid) {
      if (
        (!this.questionHeadingForm.controls['headingtext']?.value ||
          this.questionHeadingForm.controls['headingtext'].value.trim()
            .length <= 0) &&
        (!this.questionHeadingForm.controls['headingfile']?.value ||
          this.questionHeadingForm.controls['headingfile'].value.trim()
            .length <= 0)
      ) {
        this.questionHeadingForm.controls['headingtext'].setErrors({
          required: true,
        });
        this.questionHeadingForm.controls['headingfile'].setErrors({
          required: true,
        });
        this.errorMessages = {
          headingtext: 'Heading text or file is required!',
          headingfile: 'Heading text or file is required!',
        };
        valid = false;
      } else {
        this.questionHeadingForm.controls['headingtext'].setErrors(null);
        this.questionHeadingForm.controls['headingtext'].setErrors(null);
        this.errorMessages = {
          headingtext: 'Please enter heading text!',
          headingfile:
            'Please select heading file! (Enter Minimum 4 characters to search)',
        };
      }
    }
    return valid;
  };
  getFormValue = () => {
    if (this.validateForm()) {
      let tempquestionHeadingForm: any = { ...this.questionHeadingForm.value };
      if (tempquestionHeadingForm.headingfile) {
        tempquestionHeadingForm.headingfile =
          this.utilService.filemetaextractor(
            tempquestionHeadingForm.headingfile
          );
      }
      return { ...tempquestionHeadingForm };
    } else {
      return null;
    }
  };
}
