import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, debounceTime, first, map, switchMap } from 'rxjs/operators';
import { BaselineQuestionService } from 'src/app/services/baselinequestion.service';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { UtilService } from 'src/app/services/util.service';
import { QuestionService } from '../../question/services/question.service';
import { IPaging } from 'src/app/models/IPaging';
import { BaseCurriculumService } from 'src/app/services/base-curriculum.service';

@Component({
  selector: 'app-baselinequestion-index',
  templateUrl: './baselinequestion-index.component.html',
  styleUrls: ['./baselinequestion-index.component.less']
})
export class BaselinequestionIndexComponent implements OnInit {
  dataloading = false;
  invalidOrder = true;
  vaLidabaseline = false;
  disable = false;
  baseline: any;
  data: Array<any> = [];
  createForm!: UntypedFormGroup;
  cloneForm!: UntypedFormGroup;
  questionoptionList: any[] = [];
  showModalAddQuestion = false;
  showModalCloneQuestion = false;
  private questionsearchChange$ = new BehaviorSubject('');
  questionisLoading = false;
  isCurriculumLoading: boolean = false;
  searchCurriculumChange$ = new BehaviorSubject({
    baselinename: '',
    baselinetype: 1,
  });
  curriculumbaseline: any[] = [];
  baselinetype = [
    {name: 'Baseline', value: 1},
    {name: 'Midline', value: 2},
    {name: 'Endline', value: 3}
  ];
  Type: number = 0;
  curriculumBaseline: boolean = false;
  baselineData:any;
  // Typebaseline = this.cloneForm.controls['baselinetype'].value;

  async loadDataFromServer() {
    this.dataloading = true;
    const curriculumbaselineid = this.route.snapshot.paramMap.get('curriculumbaselineid') ?? '';
    this.baseline = this.route.snapshot.paramMap.get('curriculumbaselineid') ?? '';
    // const tempdata: any = await
    this.curriculumbaselineService.get(curriculumbaselineid)
    .pipe(first())
    .subscribe(
      (data: any) => {
        this.baselineData = data.data;
        const start = new Date(this.baselineData.startdate)
        const current = new Date;
        if(this.baselineData.baselinestatus){
          this.disable = true;
        }else if(start < current){
          this.disable = true;
        }
      }
    );

    this.baselinequestionservice
      .getall(curriculumbaselineid)
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
    const curriculumbaselineid = this.route.snapshot.paramMap.get('curriculumbaselineid') ?? '';
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid && this.invalidOrder) {
      await this.baselinequestionservice
        .addquizquestion(
          curriculumbaselineid,
          this.createForm.getRawValue()['questionid'],
          this.createForm.getRawValue()['baselinequestionorder']
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
      if (this.createForm.get('baselinequestionorder')?.value !== null) {
        this.notification.create('error', 'error', 'Duplicate order number');
      }
    }
  }

  async handleModalCloneQuestion() {
    // const curriculumbaselineid = this.route.snapshot.paramMap.get('curriculumbaselineid') ?? '';
    // if (this.cloneForm.get('curriculumbaselineid')?.value === null) {
    //   this.cloneForm.controls['curriculumbaselineid']?.setValidators([Validators.required]);
    // }
    this.utilservice.checkFormDirty(this.cloneForm);
    if (this.cloneForm.valid && this.Validatorbaseline()) {
      await this.baselinequestionservice
        .clonequestion(
          this.cloneForm.getRawValue()['curriculumbaselineid'],
          this.cloneForm.getRawValue()['clonecurriculumbaselineid']
        )
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'Question Clone successfully'
      );
      await this.loadDataFromServer();
      this.showModalCloneQuestion = false;
    } else {
      // this.notification.create('error', 'error', `Places choose different Curriculum Baseline!`);
      if (this.cloneForm.get('curriculumbaselineid')?.value !== null) {
        this.notification.create('error', 'error', 'Places choose different Curriculum Baseline!');
      }
    }
  }

  constructor(
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    private utilservice: UtilService,
    private readonly notification: NzNotificationService,
    private questionService: QuestionService,
    private baselinequestionservice: BaselineQuestionService,
    private curriculumbaselineService: BaseCurriculumService,
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
  }

  showModelAddQuestion = () => {
    this.createForm = this.fb.group({
      questionid: [null, [Validators.required]],
      baselinequestionorder: [null,[Validators.required, Validators.min(1), Validators.max(100)],],
    });
    this.showModalAddQuestion = true;
  };

  hideModalAddQuestion = () => {
    this.showModalAddQuestion = false;
  };

  showModelCloneQuestion = () => {
    this.setupCurriculumBaseline();
    this.cloneForm = this.fb.group({
      curriculumbaselineid: [null,[Validators.required]],
      clonecurriculumbaselineid: [null, [Validators.required]],
      baselinetype: [null, Validators.required],
    });
    this.cloneForm.get('clonecurriculumbaselineid' ?? '')
    ?.setValue(this.baselineData.curriculumbaselineid);
    this.showModalCloneQuestion = true;
  };

  hideModalCloneQuestion = () => {
    this.showModalCloneQuestion = false;
    this.curriculumBaseline = false;
  };

  reorder = async (index: number) => {
    let old = this.data[index];
    let newdata = this.data[index - 1];
    await this.baselinequestionservice
      .reorderbaselinequestion(
        old.baselinequestionid,
        newdata.baselinequestionorder,
      )
      .pipe(first())
      .toPromise();
    await this.baselinequestionservice
      .reorderbaselinequestion(
        newdata.baselinequestionid,
        old.baselinequestionorder
      )
      .pipe(first())
      .toPromise();
    await this.loadDataFromServer();
  };

  activatequestion = async (baselinequestionid: string) => {
    await this.baselinequestionservice
      .activatebaseline(baselinequestionid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Question activated successfully'
    );
    await this.loadDataFromServer();
  };

  deactivatequestion = async (baselinequestionid: string) => {
    await this.baselinequestionservice
      .deactivatebaseline(baselinequestionid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Question deactivated successfully'
    );
    await this.loadDataFromServer();
  };

  deletequestion = async (baselinequestionid: string) => {
    await this.baselinequestionservice
      .delete(baselinequestionid)
      .pipe(first())
      .toPromise();
    this.notification.create(
      'success',
      'Success',
      'Question deleted successfully'
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
    const orderValue = this.createForm.get('baselinequestionorder')?.value;
    this.invalidOrder = true;
    this.data.filter((e) => {
      if (Number(e.baselinequestionorder) === Number(orderValue)) {
        this.invalidOrder = false;
      }
    });
  }


  Validatorbaseline(){
    if(this.cloneForm.get('curriculumbaselineid')?.value === this.cloneForm.get('clonecurriculumbaselineid')?.value){
      return false;
    }else{
      return true;
    }
  }

  SearchBaslinetype(baslinetype: string){
    if(parseInt(baslinetype) > 0){
      switch (parseInt(baslinetype)){
        case 1: this.Type = 1; break;
        case 2: this.Type = 2; break;
        case 3: this.Type = 3; break;
        default: null; break;
      }
      this.onSearchCurriculumbaseline('')
      this.setupCurriculumBaseline();
      this.curriculumBaseline = true;
    }
  }

  onSearchCurriculumbaseline(value: string): void {
    this.isCurriculumLoading = true;
    this.searchCurriculumChange$.next({
      baselinename: value,
      baselinetype: this.Type,
    });
  }

  async setupCurriculumBaseline() {
    const curriculumlist$: Observable<string[]> = this.searchCurriculumChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getCurriculumbaselineList));
      curriculumlist$.subscribe((data: any) => {
      this.curriculumbaseline = data;
      if(this.cloneForm.get('baselinetype')?.value !== null && data.length > 0) {
        this.cloneForm.get('curriculumbaselineid')?.setValue(data[0].curriculumbaselineid)
      }else{
        this.cloneForm.get('curriculumbaselineid')?.setValue(' ')
      }
      this.isCurriculumLoading = false;
    });
  }

  getCurriculumbaselineList = (search: {
    baselinename: string,
    baselinetype: number,
  }): Observable<any> =>
    this.curriculumbaselineService
      .getallQuery(search.baselinename, search.baselinetype)
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
