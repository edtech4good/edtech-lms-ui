import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  catchError,
  debounceTime,
  first,
  map,
  switchMap,
} from 'rxjs/operators';
import { FileType } from 'src/app/models/enums/filetype.enum';
import { IPaging } from 'src/app/models/IPaging';
import { refusalMessage, VIDEO_DOCUMENT_TYPE_ID } from 'src/app/models/media-library';
import { LessonLearningService } from 'src/app/services/lesson.learning.service';
import { UtilService } from 'src/app/services/util.service';
import { environment } from 'src/environments/environment';
import { DocumentService } from '../../document/services/document.service';

@Component({
    selector: 'app-lesson-learning',
    templateUrl: './lesson-learning.component.html',
    styleUrls: ['./lesson-learning.component.less'],
    standalone: false
})
export class LessonLearningComponent implements OnInit {
  dataloading = false;
  currectdocument?: any;
  isUpdateLessonLearning = false;
  data: Array<any> = [];
  createForm!: UntypedFormGroup;
  documentoptionList: any[] = [];
  showGallery = false;
  showModalAddLearning = false;
  private documentsearchChange$ = new BehaviorSubject('');
  documentisLoading = false;
  async loadDataFromServer() {
    const lessonid = this.route.snapshot.paramMap.get('lessonid') ?? '';
    // const tempdata: any = await
    this.lessonlearningService
      .getlearnings(lessonid)
      .pipe(first())
      .subscribe(
        (tempdata: any) => {
          this.data = tempdata.data.map((x: any) => ({
            ...x,
            filepath: `${environment.s3Link}/${x.documentname}`,
            documenttypename: FileType[x.documenttypeid],
          }));
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

  async handleModalLearning() {
    this.isUpdateLessonLearning
      ? await this.handleModalUpdateLearning()
      : await this.handleModalAddLearning();
  }

  openGallery = (document: any) => {
    this.currectdocument = document;
    this.showGallery = true;
  };
  closeGallery = () => {
    this.currectdocument = null;
    this.showGallery = false;
  };

  /**
   * The API's reason for refusing a learning (for one: "A video item needs a video file."), in the same notice the
   * error interceptor uses. The service opts out of the interceptor's generic toast for these three statuses.
   */
  private showRefusal(error: unknown) {
    const status = (error as HttpErrorResponse)?.status;
    if (status === 400 || status === 403 || status === 404) {
      this.notification.create('error', 'Error', refusalMessage(error as HttpErrorResponse));
    }
  }

  private async handleModalAddLearning() {
    const lessonid = this.route.snapshot.paramMap.get('lessonid') ?? '';
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid) {
      try {
        await this.lessonlearningService
          .addlearning(lessonid, { ...this.createForm.value })
          .pipe(first())
          .toPromise();
      } catch (error) {
        this.showRefusal(error);
        return;
      }
      this.notification.create(
        'success',
        'Success',
        'Learning added sucessfully'
      );
      await this.loadDataFromServer();
      this.showModalAddLearning = false;
    }
  }

  private async handleModalUpdateLearning() {
    const lessonid = this.route.snapshot.paramMap.get('lessonid') ?? '';
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid) {
      try {
        await this.lessonlearningService
          .updatelearning(this.createForm.getRawValue()['lessonlearningid'], {
            ...this.createForm.value,
            lessonid,
          })
          .pipe(first())
          .toPromise();
      } catch (error) {
        this.showRefusal(error);
        return;
      }
      this.notification.create(
        'success',
        'Success',
        'Learning updated sucessfully'
      );
      await this.loadDataFromServer();
      this.showModalAddLearning = false;
    }
  }

  constructor(
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    private utilservice: UtilService,
    private lessonlearningService: LessonLearningService,
    private readonly notification: NzNotificationService,
    private documentService: DocumentService,
    public sanitizer: DomSanitizer
  ) {}

  async ngOnInit() {
    this.dataloading = true;
    const getdocument = (filename: string) => {
      let temp = new IPaging();
      temp.pagesize = 20;
      temp.filter = [
        {
          key: 'documenttags',
          value: filename || '----',
        },
        // a learning is a video: the picker offers video files only (the API refuses any other)
        {
          key: 'documenttypeid',
          value: String(VIDEO_DOCUMENT_TYPE_ID),
        },
      ];
      const httpobject = this.documentService.getall(temp).pipe(
        catchError(async () => ({ data: { data: [] } })),
        map((res: any) => res.data.data)
      );
      return httpobject;
    };
    const documentoptionList$: Observable<string[]> = this.documentsearchChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(getdocument));
    documentoptionList$.subscribe((data) => {
      this.documentoptionList = data;
      this.documentisLoading = false;
    });

    await this.loadDataFromServer();
  }
  showModelAddLearning = () => {
    this.isUpdateLessonLearning = false;
    this.createForm = this.fb.group({
      documentid: [null, [Validators.required]],
      lessonlearningorder: [
        null,
        [Validators.required, Validators.min(1), Validators.max(100)],
      ],
      lessonlearningname: [
        null,
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
        ],
      ],
      lessonlearningdescription: [
        null,
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(500),
        ],
      ],
    });
    this.showModalAddLearning = true;
  };

  showModelUpdateLearning = async (lessonlearningid: string) => {
    const lessonid = this.route.snapshot.paramMap.get('lessonid') ?? '';
    this.isUpdateLessonLearning = true;
    this.createForm = this.fb.group({
      lessonlearningid: [lessonlearningid, [Validators.required]],
      documentid: [null, [Validators.required]],
      lessonlearningname: [
        null,
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
        ],
      ],
      lessonlearningdescription: [
        null,
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(500),
        ],
      ],
    });
    this.lessonlearningService
      .getlearning(lessonid, lessonlearningid)
      .pipe(first())
      .subscribe((tempdata: any) => {
        if (tempdata.error) {
          this.notification.create('error', 'error', 'Invalid link');
          return;
        }
        this.documentoptionList = [];
        this.documentoptionList.push({
          documentid: tempdata.data.documentid,
          documentname: tempdata.data.documentname,
          documenttitle: tempdata.data.documenttitle,
        });
        const cc = this.createForm.get('documentid');
        cc?.setValue(tempdata.data.documentid);
        this.createForm
          .get('lessonlearningname')
          ?.setValue(tempdata.data.lessonlearningname);
        this.createForm
          .get('lessonlearningdescription')
          ?.setValue(tempdata.data.lessonlearningdescription);
        this.showModalAddLearning = true;
      });
  };
  hideModalAddLearning = () => {
    this.showModalAddLearning = false;
  };
  reorder = async (index: number) => {
    let old = this.data[index];
    let newdata = this.data[index - 1];
    await this.lessonlearningService
      .reorderlearning(old.lessonlearningid, newdata.lessonlearningorder)
      .pipe(first())
      .toPromise();
    await this.lessonlearningService
      .reorderlearning(newdata.lessonlearningid, old.lessonlearningorder)
      .pipe(first())
      .toPromise();
    await this.loadDataFromServer();
  };

  activatedocument = async (lessonlearningdocumentid: string) => {
    await this.lessonlearningService
      .activatelearning(lessonlearningdocumentid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Learning activated sucessfully'
    );
    await this.loadDataFromServer();
  };

  deactivatedocument = async (lessonlearningdocumentid: string) => {
    await this.lessonlearningService
      .deactivatelearning(lessonlearningdocumentid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Learning deactivated sucessfully'
    );
    await this.loadDataFromServer();
  };

  deletedocument = async (lessonlearningdocumentid: string) => {
    await this.lessonlearningService
      .deletelearning(lessonlearningdocumentid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Learning deleted sucessfully'
    );
    await this.loadDataFromServer();
  };

  documentcreateonSearch(value: string): void {
    this.documentisLoading = true;
    if ((value || '').trim().length <= 2) {
      return;
    }
    this.documentsearchChange$.next(value);
  }
}
