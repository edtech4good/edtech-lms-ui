import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
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
import { LessonLearningService } from 'src/app/services/lesson.learning.service';
import { UtilService } from 'src/app/services/util.service';
import { environment } from 'src/environments/environment';
import { DocumentService } from '../../document/services/document.service';
import { LessonPlanService } from 'src/app/services/lesson.plan.service';

@Component({
  selector: 'app-lesson-plan',
  templateUrl: './lesson-plan.component.html',
  styleUrls: ['./lesson-plan.component.less'],
})
export class LessonPlanComponent implements OnInit {
  dataloading = false;
  currectdocument?: any;
  isUpdateLessonPlan = false;
  data: Array<any> = [];
  createForm!: FormGroup;
  documentoptionList: any[] = [];
  showGallery = false;
  showModalAddPlan = false;
  private documentsearchChange$ = new BehaviorSubject('');
  documentisLoading = false;
  async loadDataFromServer() {
    const lessonid = this.route.snapshot.paramMap.get('lessonid') ?? '';
    // const tempdata: any = await
    this.lessonplanService
      .getplans(lessonid)
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

  async handleModalPlan() {
    this.isUpdateLessonPlan
      ? await this.handleModalUpdatePlan()
      : await this.handleModalAddPlan();
  }

  openGallery = (document: any) => {
    this.currectdocument = document;
    this.showGallery = true;
  };
  closeGallery = () => {
    this.currectdocument = null;
    this.showGallery = false;
  };

  private async handleModalAddPlan() {
    const lessonid = this.route.snapshot.paramMap.get('lessonid') ?? '';
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid) {
      await this.lessonplanService
        .addplan(lessonid, { ...this.createForm.value })
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'Lesson Plan added sucessfully'
      );
      await this.loadDataFromServer();
      this.showModalAddPlan = false;
    }
  }

  private async handleModalUpdatePlan() {
    const lessonid = this.route.snapshot.paramMap.get('lessonid') ?? '';
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid) {
      await this.lessonplanService
        .updateplan(this.createForm.getRawValue()['lessonplanid'], {
          ...this.createForm.value,
          lessonid,
        })
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'Plan updated sucessfully'
      );
      await this.loadDataFromServer();
      this.showModalAddPlan = false;
    }
  }

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private utilservice: UtilService,
    private lessonlearningService: LessonPlanService,
    private lessonplanService: LessonPlanService,
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
  showModelAddPlan = () => {
    this.isUpdateLessonPlan = false;
    this.createForm = this.fb.group({
      documentid: [null, [Validators.required]],
      lessonplanorder: [
        null,
        [Validators.required, Validators.min(1), Validators.max(100)],
      ],
      lessonplanname: [
        null,
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
        ],
      ],
      lessonplandescription: [
        null,
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(500),
        ],
      ],
    });
    this.showModalAddPlan = true;
  };

  showModelUpdatePlan = async (lessonplanid: string) => {
    const lessonid = this.route.snapshot.paramMap.get('lessonid') ?? '';
    this.isUpdateLessonPlan = true;
    this.createForm = this.fb.group({
      lessonplanid: [lessonplanid, [Validators.required]],
      documentid: [null, [Validators.required]],
      lessonplanname: [
        null,
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
        ],
      ],
      lessonplandescription: [
        null,
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(500),
        ],
      ],
    });
    this.lessonplanService
      .getplan(lessonid, lessonplanid)
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
        });
        const cc = this.createForm.get('documentid');
        cc?.setValue(tempdata.data.documentid);
        this.createForm
          .get('lessonplanname')
          ?.setValue(tempdata.data.lessonplanname);
        this.createForm
          .get('lessonplandescription')
          ?.setValue(tempdata.data.lessonplandescription);
        this.showModalAddPlan = true;
      });
  };
  hideModalAddPlan = () => {
    this.showModalAddPlan = false;
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
      'Plan activated sucessfully'
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
      'Plan deactivated sucessfully'
    );
    await this.loadDataFromServer();
  };

  deleteplan = async (lessonplandocumentid: string) => {
    await this.lessonplanService
      .deleteplan(lessonplandocumentid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Plan deleted sucessfully'
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
