import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable } from 'rxjs';
import { catchError, first, map } from 'rxjs/operators';
import { CountryService } from 'src/app/services/country.service';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { SubjectService } from 'src/app/services/subject.service';
import { UtilService } from 'src/app/services/util.service';
import { OrganisationService } from '../../organisation/organisation.service';
import { RecognitionField, readFailure, recognitionDefaultsFor, recognitionToCreate } from '../curriculum-recognition';

@Component({
    selector: 'app-curriculum-create',
    templateUrl: './curriculum-create.component.html',
    styleUrls: ['./curriculum-create.component.less'],
    standalone: false
})
export class CurriculumCreateComponent implements OnInit {
  dataloading = false
  country$?: Observable<any>;
  subject$?: Observable<any>;
  createForm!: UntypedFormGroup;
  valid = false;
  /** The API's sentence for a tier it refused, shown beside that select. */
  recognitionErrors: Partial<Record<RecognitionField, string>> = {};
  /** The organisation's preset was read, so the selects show its defaults and the values are sent; otherwise central fills them in. */
  private recognitionKnown = false;
  async submitcreateForm() {
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid && this.valid) {
      this.recognitionErrors = {};
      try {
        await this.dts
          .create(
            this.createForm.getRawValue()['curriculumname'],
            this.createForm.getRawValue()['curriculumdescription'] || '',
            this.createForm.getRawValue()['countryid'],
            this.createForm.getRawValue()['subjectid'],
            recognitionToCreate(
              {
                levelrecognition: this.createForm.getRawValue()['levelrecognition'],
                graderecognition: this.createForm.getRawValue()['graderecognition'],
                curriculumrecognition: this.createForm.getRawValue()['curriculumrecognition'],
              },
              this.recognitionKnown,
            ),
          )
          .pipe(first())
          .toPromise();
      } catch (failure: any) {
        // Stay on the form: a tier the API refused is shown beside its select, anything else it silenced is one toast.
        const read = readFailure(failure ?? {});
        this.recognitionErrors = read.fields;
        if (read.toast) this.notification.create('error', 'error', read.toast);
        return;
      }
        setTimeout(() => {
          this.notification.create(
            'success',
            'Success',
            'Curriculum created sucessfully'
          );
        }, 400);
      this.router.navigate(['curriculum/index']);
    } else {
      if (this.createForm.get('curriculumname')?.value !== null && this.createForm.get('curriculumname')?.value !== '' ) {
        this.notification.create(
          'error',
          'error',
          'Special characters are not allowed'
        );
      }
    }
  }
  constructor(
    private fb: UntypedFormBuilder,
    private dts: CurriculumService,
    private subjectService: SubjectService,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
    private readonly countryService: CountryService,
    private readonly organisations: OrganisationService,
  ) {}

  ngOnInit(): void {
    this.dataloading = true;
    this.createForm = this.fb.group({
      curriculumname: [null, [Validators.required]],
      curriculumdescription: [
        null,
        [Validators.maxLength(500)],
      ],
      countryid: [null, [Validators.required]],
      subjectid: [null, [Validators.required]],
      levelrecognition: [null],
      graderecognition: [null],
      curriculumrecognition: [null],
    });
    // Preselect the acting organisation's preset defaults. Where they cannot be known (a platform account acting in none, or the
    // read failed) nothing is chosen or sent: the selects say "Organisation default" and central fills them in.
    this.organisations.mine().pipe(first()).subscribe({
      next: (org) => {
        if (!org) return;
        this.createForm.patchValue(recognitionDefaultsFor(org.organisationpreset));
        this.recognitionKnown = true;
      },
      error: () => {},
    });
    // load all country
    this.country$ = this.countryService.getall({ pagesize: 200 }).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => {
        return x.data.data;
      })
    );
    this.country$.subscribe();
    // load all subject
    this.subject$ = this.subjectService.getall({ pagesize: 200 }).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => {
        return x.data.data;
      })
    );
    this.subject$.subscribe();
    setTimeout(() => {
      this.dataloading = false;
    }, 400);
  }

  restrictSpecialCharecter() {
    const scholname = this.createForm.get('curriculumname')?.value;
    var format = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
    console.log('curriculumname name is', scholname);
    if (format.test(scholname)) {
      this.valid = false;
      this.notification.create(
        'warning',
        'warning',
        'Special characters are not allowed'
      );
      return;
    } else {
      this.valid = true;
    }
  }
}
