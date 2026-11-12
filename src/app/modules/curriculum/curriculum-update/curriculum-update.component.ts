import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable, Subscription } from 'rxjs';
import { catchError, first, map } from 'rxjs/operators';
import { CountryService } from 'src/app/services/country.service';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { SubjectService } from 'src/app/services/subject.service';
import { NOT_FOUND_TOAST_KEY } from 'src/app/interceptors/error.interceptor';
import { UtilService } from 'src/app/services/util.service';
import { RecognitionField, changedRecognition, readFailure, storedRecognition } from '../curriculum-recognition';
import { Pill, pillOf } from 'src/app/shared/publication/publication.model';

@Component({
    selector: 'app-curriculum-update',
    templateUrl: './curriculum-update.component.html',
    styleUrls: ['./curriculum-update.component.less'],
    standalone: false
})
export class CurriculumUpdateComponent implements OnInit, OnDestroy {
  dataloading = false;
  country$?: Observable<any>;
  subject$?: Observable<any>;
  valid = false;
  editForm!: UntypedFormGroup;
  curriculum: any;
  /** The curriculum's publication state, shown in the header: read once on load (nothing acts on it here). */
  publicationPill: Pill | null = null;
  /** The state could not be read: the header says a dash, quietly. */
  publicationUnknown = false;
  private publicationRead?: Subscription;
  /** The API's sentence for a tier it refused, shown beside that select. */
  recognitionErrors: Partial<Record<RecognitionField, string>> = {};
  /** What the curriculum read carried; only a tier changed from it is sent. */
  private storedRecognition = storedRecognition(null);
  async submiteditForm() {
    this.restrictSpecialCharecter();
    this.utilservice.checkFormDirty(this.editForm);
    if (this.editForm.valid && this.valid) {
      this.recognitionErrors = {};
      const raw = this.editForm.getRawValue();
      try {
        await this.dts
          .update(
            {
              curriculumdescription: raw['curriculumdescription'] || '',
              curriculumname: raw['curriculumname'],
              curriculumid: this.curriculum.curriculumid,
              countryid: raw['countryid'],
              subjectid: raw['subjectid'],
            },
            changedRecognition(this.storedRecognition, {
              levelrecognition: raw['levelrecognition'],
              graderecognition: raw['graderecognition'],
              curriculumrecognition: raw['curriculumrecognition'],
            }),
          )
          .pipe(first())
          .toPromise();
      } catch (failure: any) {
        // Stay on the form: a tier the API refused is shown beside its select, anything else it silenced is one toast.
        const read = readFailure(failure ?? {}, NOT_FOUND_TOAST_KEY);
        this.recognitionErrors = read.fields;
        if (read.toast) this.notification.create('error', 'Error', read.toast, read.toastKey ? { nzKey: read.toastKey } : undefined);
        return;
      }
      setTimeout(() => {
        this.notification.create(
          'success',
          'Success',
          'Curriculum updated successfully'
        );
      }, 400);
      this.router.navigate(['curriculum/index']);
    } else {
      const scholname = this.editForm.get('curriculumname')?.value;
      var format = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
      if (format.test(scholname)) {
        this.notification.create(
          'error',
          'error',
          'Special characters are not allowed'
        );
        return;
      }
    }
  }
  constructor(
    private fb: UntypedFormBuilder,
    private dts: CurriculumService,
    private route: ActivatedRoute,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
    private readonly countryService: CountryService,
    private subjectService: SubjectService,
  ) {}

  ngOnInit() {
    this.dataloading = true;
    this.editForm = this.fb.group({
      curriculumname: [null, [Validators.required]],
      curriculumdescription: [
        null,
        [Validators.maxLength(500), Validators.min(3)],
      ],
      countryid: [null, [Validators.required]],
      subjectid: [null, [Validators.required]],
      levelrecognition: [null],
      graderecognition: [null],
      curriculumrecognition: [null],
    });
    const curriculumid = this.route.snapshot.paramMap.get('curriculumid') ?? '';
    if ((curriculumid || '').trim().length <= 0) {
      this.notification.create('error', 'error', 'Invalid link');
      this.router.navigate(['curriculum/index']);
      return;
    }
    // The header's pill. Every failure is the header's own (a dash): the interceptor says nothing.
    this.publicationRead = this.dts.publication(curriculumid, true).subscribe({
      next: (overview) => {
        this.publicationPill = pillOf(overview);
      },
      error: () => {
        this.publicationUnknown = true;
      },
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
    this.dts
      .get(curriculumid)
      .pipe(first())
      .subscribe((tempdata: any) => {
        if (tempdata.error) {
          this.notification.create('error', 'error', 'Invalid link');
          this.router.navigate(['curriculum/index']);
        }
        this.curriculum = tempdata.data;
        this.editForm
          .get('curriculumname')
          ?.setValue(this.curriculum.curriculumname);
        this.editForm
          .get('curriculumdescription')
          ?.setValue(this.curriculum.curriculumdescription);
        this.editForm
          .get('countryid')
          ?.setValue(this.curriculum.countryid);
        this.editForm
          .get('subjectid')
          ?.setValue(this.curriculum.subjectid);
        this.storedRecognition = storedRecognition(this.curriculum);
        this.editForm.patchValue(this.storedRecognition);
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
  }
  ngOnDestroy(): void {
    this.publicationRead?.unsubscribe();
  }
  restrictSpecialCharecter() {
    const scholname = this.editForm.get('curriculumname')?.value;
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
