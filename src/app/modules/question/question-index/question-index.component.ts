import { HttpResponse } from '@angular/common/http';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { faCircle, faSlash } from '@fortawesome/free-solid-svg-icons';
import { delay, xor } from 'lodash';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { filter, first, catchError, delayWhen } from 'rxjs/operators';
import { TemplateType } from 'src/app/models/enums/templatetypes.enum';
import { IFilter, IPaging } from 'src/app/models/IPaging';
import { Question } from 'src/app/models/question.model';
import { QuestionTagService } from 'src/app/services/question-tag.service';
import { UtilService } from 'src/app/services/util.service';
import { QuestionService } from '../services/question.service';
import { error } from 'console';
import { errorMonitor } from 'events';
import { pipe } from 'rxjs';
@Component({
    selector: 'app-question-index',
    templateUrl: './question-index.component.html',
    styleUrls: ['./question-index.component.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class QuestionIndexComponent implements OnInit, AfterContentInit {
  dataloading = false;
  expandSet = new Set<number>();
  onExpandChange(id: number, checked: boolean): void {
    if (checked) {
      this.expandSet.add(id);
    } else {
      this.expandSet.delete(id);
    }
  }

  questioneditId: string | null = null;
  questioneditvalue: string | null = null;

  startEdit(data: Question): void {
    this.questioneditvalue = data.questionidentifier;
    this.questioneditId = data.questionid;
  }

  saveQuestionIdentifier = async (data: Question) => {
    this.cd.markForCheck();
    await this.questionService
      .updateIdentifier(data.questionid, this.questioneditvalue || '')
      .toPromise();
    this.questioneditvalue = null;
    this.questioneditId = null;
    this.notification.create(
      'success',
      'Success',
      'Question identifier updated sucessfully'
    );
    await this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
  };

  stopEdit(): void {
    this.questioneditId = null;
    this.questioneditvalue = null;
  }

  selectedTag: any;
  faCoffee = faCircle;
  searchquestionIdentifierValue = '';
  searchquestionTypeValue = '';
  searchquestionTagValue = '';
  searchquestionStatusValue = '';
  total = 1;
  data: Array<any> = [];
  pageSize = 10;
  pageIndex = 1;
  filter: Array<IFilter> = [];
  showquestionIdentifierFilter = false;
  showquestionTypeFilter = false;
  showquestionStatusFilter = false;
  showquestionTagFilter = false;
  questiontags: Array<any> = [];

  settings = {
    counter: false,
    plugins: [],
  };

  async ngOnInit(): Promise<void> {
    const getDataTag = sessionStorage.getItem('storeTagValue') ?? '';
    const getDataIndentifier = sessionStorage.getItem('storeIdentifierValue') ?? '';
    const getDataStatus = sessionStorage.getItem('storeStatusValue') ?? '';
    const getDataType = sessionStorage.getItem('storeTypeValue') ?? '';
    const getPageIndex = sessionStorage.getItem('pageIndex') ?? '';
    const getQuestion = sessionStorage.getItem('Question') ?? '[]';

    if(
        this.questiontags.length === 0 &&
        getDataIndentifier === '' &&
        getDataStatus === '' &&
        getDataType === '' &&
        getDataTag === '' &&
        getPageIndex === ''
      ){
      this.buildFilter()
    }else{
      this.dataloading = true;
      this.questiontags = JSON.parse(getQuestion);
      this.searchquestionTagValue = JSON.parse(getDataTag);
      this.searchquestionIdentifierValue = JSON.parse(getDataIndentifier);
      this.searchquestionStatusValue = JSON.parse(getDataStatus);
      this.searchquestionTypeValue = JSON.parse(getDataType);
      this.searchquestionTag()
      this.searchquestionIdentifier()
      this.searchquestionType()
      this.searchquestionStatus()
      setTimeout(() => {
        this.pageIndex = JSON.parse(getPageIndex);
        this.dataloading = true
      }, 2);
    };

  }

  storeData(){
    sessionStorage.setItem('Question',JSON.stringify(this.questiontags));
    sessionStorage.setItem('storeTagValue',JSON.stringify(this.searchquestionTagValue));
    sessionStorage.setItem('storeIdentifierValue',JSON.stringify(this.searchquestionIdentifierValue));
    sessionStorage.setItem('storeStatusValue',JSON.stringify(this.searchquestionStatusValue));
    sessionStorage.setItem('storeTypeValue',JSON.stringify(this.searchquestionTypeValue));
    sessionStorage.setItem('pageIndex',JSON.stringify(this.pageIndex));
  }

  clearData(){
    sessionStorage.removeItem('storeTagValue');
    sessionStorage.removeItem('storeIdentifierValue');
    sessionStorage.removeItem('storeStatusValue');
    sessionStorage.removeItem('storeTypeValue');
    sessionStorage.removeItem('pageIndex');
    setTimeout( () => {
      window.location.reload();
    }, 200);
  }

  async buildFilter(){
    const data: any = await this.dts.getall(new IPaging()).toPromise();
    this.questiontags = data.data.data;
    let size = this.utilService.convertToInt(
      this.route.snapshot.queryParamMap.get('pageSize')
    );
    if (size) {
      this.pageSize = size;
    }
    let index = this.utilService.convertToInt(
      this.route.snapshot.queryParamMap.get('pageIndex')
    );
    if (index) {
      this.pageIndex = index;
    }
    let filter = this.route.snapshot.queryParamMap.get('filter');
    if (filter) {
      this.filter = JSON.parse(filter);
    }
  }

  showAddTag = (question: any) =>
    !(question?.questiontags?.length >= this.questiontags?.length);
  addTagList = (question: any) =>
    xor(
      this.questiontags.map((x) => x.questiontagname),
      question.questiontags
    );
  showMenuTag = (question: any, tag: string) =>
    !question.questiontags.find((x: string) => x === tag);

  async loadDataFromServer(paging: IPaging) {
    this.dataloading = true;
    this.pageIndex = paging.pageindex || 1;
    this.filter = paging.filter || [];
    this.pageSize = paging.pagesize || 10;
    const templatetypeentries = Object.fromEntries(
      Object.entries(TemplateType).map((x) => [
        x[1].templateid.toString(),
        x[1],
      ])
    );
    const tempdata: any = await this.questionService
      .getall(paging)
      .pipe(first(),
      catchError((error) => {
        this.dataloading = false;
        return error;
      }))
      .toPromise();
      this.total = tempdata.data.total;
      this.data = tempdata.data.data.map((x: any) => ({
        ...x,
        templatename: templatetypeentries[x.templatetypeid].templatename,
        addTagList: this.addTagList(x)
      }));
    this.router.navigate([], {
      queryParams: {
        pageSize: this.pageSize,
        pageIndex: this.pageIndex,
        filter: JSON.stringify(this.filter),
      },
    });
    this.cd.markForCheck();
    this.loading(tempdata.data.data);
  }

  async loading(data: any){
    const tempdata = await data;
    if(tempdata.error){
      this.dataloading = false;
    }
    if(tempdata.length > 0 && tempdata !== '[]'){
      this.dataloading = false;
    }
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = params;
    await this.loadDataFromServer({
      filter: this.filter,
      pageindex: pageIndex,
      pagesize: pageSize,
    });
    this.storeData()
  }

  delete = async (questionid: string) => {
    await this.questionService
      .delete(questionid)
      .pipe(
        filter((e) => e instanceof HttpResponse)
        //first()
      )
      .toPromise();
    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
    this.notification.create(
      'success',
      'Success',
      'Question deleted successfully'
    );
  };

  activatequestion = async (questionid: string) => {
    await this.questionService.activate(questionid).pipe(first()).toPromise();

    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
    this.notification.create(
      'success',
      'Success',
      'Question activated successfully'
    );
  };

  deactivatequestion = async (questionid: string) => {
    await this.questionService.deactivate(questionid).pipe(first()).toPromise();
    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
    this.notification.create(
      'success',
      'Success',
      'Question deactivated successfully'
    );
  };

  constructor(
    private questionService: QuestionService,
    private readonly notification: NzNotificationService,
    public sanitizer: DomSanitizer,
    private dts: QuestionTagService,
    private cd: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private utilService: UtilService
  ) {}
  ngAfterContentInit(): void {
    this.cd.markForCheck();
  }

  async searchquestionIdentifier() {
    this.showquestionIdentifierFilter = false;
    if (this.searchquestionIdentifierValue.length > 0) {
      await this.loadDataFromServer({
        filter: [
          ...this.filter.filter((x) => x.key !== 'questionidentifier'),
          ...[
            {
              key: 'questionidentifier',
              value: this.searchquestionIdentifierValue,
            },
          ],
        ],
        pageindex: 1,
        pagesize: this.pageSize,
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter((x) => x.key !== 'questionidentifier'),
        pageindex: 1,
        pagesize: this.pageSize,
      });
    }
    this.storeData()
  }

  async searchquestionType() {
    let template = '';
    if (this.searchquestionTypeValue.includes('mcq text')) {
      template = 'MCQ Single response Text and Audio';
    } else if (this.searchquestionTypeValue.includes('mcq pic')) {
      template = 'MCQ Single response Picture';
    } else if (this.searchquestionTypeValue.includes('multi text')) {
      template = 'MCQ Multi Correct Text and Audio';
    } else if (this.searchquestionTypeValue.includes('multi pic')) {
      template = 'MCQ Multi Correct Picture';
    } else template = this.searchquestionTypeValue;
    // console.log('TEMPLATE IS................', template);
    this.showquestionTypeFilter = false;
    if (this.searchquestionTypeValue.length > 0) {
      const enumdata = Object.entries(TemplateType).find((x) =>
        x[1].templatename
          .replace('(', '')
          .replace(')', '')
          .toUpperCase()
          .includes(template.toUpperCase())
      );

      if (!enumdata) {
        this.notification.create('error', 'Error', 'Invalid question type');
        return;
      }
      await this.loadDataFromServer({
        filter: [
          ...this.filter.filter((x) => x.key !== 'templatetypeid'),
          ...[
            { key: 'templatetypeid', value: enumdata[1].templateid.toString() },
            { key: 'templatetypeid', value: enumdata[1].templateid.toString() },
          ],
        ],
        pageindex: 1,
        pagesize: this.pageSize,
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter((x) => x.key !== 'templatetypeid'),
        pageindex: 1,
        pagesize: this.pageSize,
      });
    }
    this.storeData()
  }

  searchquestionTag = async () => {
    this.showquestionTagFilter = false;
    if (this.searchquestionTagValue.length > 0) {
      let searchvalues = this.searchquestionTagValue.split(',');
      if (searchvalues.length > 1) {
        for (let index = 0; index < searchvalues.length; index++) {
          const element = searchvalues[index];
          const enumdata = this.questiontags.find(
            (x) =>
              x.questiontagname.toUpperCase() === element.trim().toUpperCase()
          );
          if (!enumdata) {
            this.notification.create('error', 'Error', 'Invalid question tag');
            return;
          }
        }
      } else {
        const enumdata = this.questiontags.find(
          (x) =>
            x.questiontagname.toUpperCase() ===
            this.searchquestionTagValue.toUpperCase()
        );
        if (!enumdata) {
          this.notification.create('error', 'Error', 'Invalid question tag');
          return;
        }
      }
      await this.loadDataFromServer({
        filter: [
          ...this.filter.filter((x) => x.key !== 'questiontags'),
          ...[{ key: 'questiontags', value: this.searchquestionTagValue }],
        ],
        pageindex: 1,
        pagesize: this.pageSize,
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter((x) => x.key !== 'questiontags'),
        pageindex: 1,
        pagesize: this.pageSize,
      });
    }
    this.storeData()
  };

  searchquestionStatus = async () => {
    this.showquestionStatusFilter = false;
    if (this.searchquestionStatusValue.length > 0) {
      let searchvalue = this.searchquestionStatusValue.trim().toLowerCase();
      if (searchvalue !== 'yes' && searchvalue !== 'no') {
        this.notification.create(
          'error',
          'Error',
          'Invalid question status (only Yes/No allowed)'
        );
        return;
      }
      await this.loadDataFromServer({
        filter: [
          ...this.filter.filter((x) => x.key !== 'questionstatus'),
          ...[
            {
              key: 'questionstatus',
              value: searchvalue === 'yes' ? 'true' : 'false',
            },
          ],
        ],
        pageindex: 1,
        pagesize: this.pageSize,
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter((x) => x.key !== 'questionstatus'),
        pageindex: 1,
        pagesize: this.pageSize,
      });
    }
    this.storeData()
  };

  addTag = async (tag: any, questionid: string) => {
    this.selectedTag = undefined;
    await this.questionService.addtag(questionid, tag).toPromise();
    await this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
  };

  removeTag = async (questionid: string, tag: string) => {
    this.selectedTag = undefined;
    await this.questionService.removeTag(questionid, tag).toPromise();
    await this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
  };

  resetsearchquestionTypeValue(): void {
    sessionStorage.removeItem('storeTypeValue')
    this.searchquestionTypeValue = '';
    this.searchquestionType();
  }

  resetsearchquestionIdentifierValue(): void {
    sessionStorage.removeItem('storeIdentifierValue')
    this.searchquestionIdentifierValue = '';
    this.searchquestionIdentifier();
  }

  resetsearchquestionTagValue(): void {
    sessionStorage.removeItem('storeTagValue')
    this.searchquestionTagValue = '';
    this.searchquestionTag();
  }
  resetsearchquestionStatusValue(): void {
    sessionStorage.removeItem('storeStatusValue')
    this.searchquestionStatusValue = '';
    this.searchquestionStatus();
  }
}
