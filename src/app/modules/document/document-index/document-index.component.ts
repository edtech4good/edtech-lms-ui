import { HttpResponse } from '@angular/common/http';
import { AfterContentInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { xor } from "lodash";
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzUploadFile } from 'ng-zorro-antd/upload';
import { of } from 'rxjs';
import { catchError, filter, first, map } from 'rxjs/operators';
import { FileType } from 'src/app/models/enums/filetype.enum';
import { IFilter, IPaging } from 'src/app/models/IPaging';
import { DocumentTagService } from 'src/app/services/document-tag.service';
import { UtilService } from 'src/app/services/util.service';
import { setloadingAction, unsetloadingAction } from 'src/app/store/appstate/appstate.action';
import { appState } from 'src/app/store/appstate/appstate.reducer';
import { DocumentService } from '../services/document.service';
import { environment } from "./../../../../environments/environment";
@Component({
  selector: 'app-document-index',
  templateUrl: './document-index.component.html',
  styleUrls: ['./document-index.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentIndexComponent implements OnInit, AfterContentInit {
  dataloading = false;
  selectedTag: any;
  currectdocument?: any;
  searchdocumentNameValue = '';
  searchdocumentTypeValue = '';
  searchdocumentTagValue = '';
  showGallery = false;
  total = 1;
  data: Array<any> = [];
  pageSize = 10;
  pageIndex = 1;
  filter: Array<IFilter> = [];
  showdocumentNameFilter = false;
  showdocumentTypeFilter = false;
  showdocumentTagFilter = false;
  showUpload = false;
  uploading = false;
  fileList: NzUploadFile[] = [];
  documenttags: Array<any> = [];


  hideuploadDocument = () => {
    this.showUpload = false;
  }

  showuploadDocument = () => {
    this.showUpload = true;
  }
  openGallery = (document: any) => {
    this.currectdocument = document;
    this.showGallery = true;
  }
  closeGallery = () => {
    this.currectdocument = null;
    this.showGallery = false;
  }
  settings = {
    counter: false,
    plugins: [],
  };

  onClose = () => { }
  beforeUpload = (file: NzUploadFile): boolean => {
    this.fileList = this.fileList.concat(file);
    return false;
  };
  async ngOnInit(): Promise<void> {
    let tempPage = new IPaging();
    tempPage.pagesize = 200;
    const data: any = await this.dts.getall(tempPage).toPromise();
    this.documenttags = data.data.data;

    let size = this.utilService.convertToInt(this.route.snapshot.queryParamMap.get('pageSize'));
    if (size) {
      this.pageSize = size;
    }
    let index = this.utilService.convertToInt(this.route.snapshot.queryParamMap.get('pageIndex'));
    if (index) {
      this.pageIndex = index;
    }
    let filter = this.route.snapshot.queryParamMap.get('filter');
    if (filter) {
      this.filter = JSON.parse(filter);
    }
  }

  showAddTag = (document: any) => !(document?.documenttags?.length >= this.documenttags?.length)
  addTagList = (document: any) => xor(this.documenttags.map(x => x.documenttagname), document.documenttags)
  showMenuTag = (document: any, tag: string) => !document.documenttags.find((x: string) => x === tag)

  handleUpload(): void {
    const formData = new FormData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.fileList.forEach((file: any) => {
      formData.append('files[]', file);
    });
    this.store.dispatch(setloadingAction());
    this.uploading = true;
    this.documentService.upload(formData)
      .pipe(catchError(async () => {
        this.store.dispatch(unsetloadingAction());
        this.uploading = false;
        return null;
      }), filter(e => e instanceof HttpResponse))
      .subscribe(async x => {
        this.store.dispatch(unsetloadingAction());
        this.notification.create("success", 'Success', "Document uploaded sucessfully");
        this.uploading = false;
        this.fileList = [];
        this.hideuploadDocument();
        await this.loadDataFromServer({
          filter: [...this.filter],
          pageindex: this.pageIndex,
          pagesize: this.pageSize
        });
      })
  }

  async loadDataFromServer(paging: IPaging) {
    this.dataloading = true;
    this.pageIndex = paging.pageindex || 1;
    this.filter = paging.filter || [];
    this.pageSize = paging.pagesize || 10;
    const tempdata: any = await
    this.documentService
    .getall(paging)
    .pipe(first())
    .toPromise();
    this.total = tempdata.data.total;
    this.data = tempdata.data.data.map((x: any) => ({
      ...x,
      filepath: `${environment.s3Link}/${x.documentname}`,
      documenttypename: FileType[x.documenttypeid],
      addTagList: this.addTagList(x)
    }));
    // console.log(tempdata.data.data)
    this.loading(tempdata.data.data)
    this.router.navigate([], {
      queryParams: { pageSize: this.pageSize, pageIndex: this.pageIndex, filter: JSON.stringify(this.filter) }
    });
    this.cd.markForCheck();
  }

  async loading(data: any){
    const tempdata = await data;
    if(!tempdata.error){
      this.dataloading = false;
    }
    if(tempdata.length > 0 && tempdata !== '[]'){
      setTimeout(() => {
        this.dataloading = false;
      }, 600);
    }
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = params;
    await this.loadDataFromServer({
      filter: this.filter,
      pageindex: pageIndex,
      pagesize: pageSize
    });
  }

  delete = async (documentid: string) => {
    await this.documentService.delete(documentid).pipe(first()).toPromise();
    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize
    })
    this.notification.create("success", 'Success', "Document deleted sucessfully");
  }

  constructor(
    private documentService: DocumentService,
    private readonly notification: NzNotificationService,
    public sanitizer: DomSanitizer,
    private dts: DocumentTagService,
    private cd: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private utilService: UtilService,
    private store: Store<appState>
  ) { }
  ngAfterContentInit(): void {
    this.cd.markForCheck();
  }

  async searchdocumentName() {
    this.showdocumentNameFilter = false;
    if (this.searchdocumentNameValue.length > 0) {
      await this.loadDataFromServer({
        filter: [...this.filter.filter(x => x.key !== "documentname"), ...[{ key: "documentname", value: this.searchdocumentNameValue }]],
        pageindex: 1,
        pagesize: this.pageSize
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter(x => x.key !== "documentname"),
        pageindex: 1,
        pagesize: this.pageSize
      });
    }
  }

  async searchdocumentType() {
    this.showdocumentTypeFilter = false;
    if (this.searchdocumentTypeValue.length > 0) {
      const enumdata = Object.entries(FileType).find(x => x[0] === this.searchdocumentTypeValue.toUpperCase())
      if (!enumdata) {
        this.notification.create("error", 'Error', "Invalid document type");
        return;
      }
      await this.loadDataFromServer({
        filter: [...this.filter.filter(x => x.key !== "documenttypeid"), ...[{ key: "documenttypeid", value: enumdata[1].toString() }]],
        pageindex: 1,
        pagesize: this.pageSize
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter(x => x.key !== "documenttypeid"),
        pageindex: 1,
        pagesize: this.pageSize
      });
    }
  }

  searchdocumentTag = async () => {
    this.showdocumentTagFilter = false;
    if (this.searchdocumentTagValue.length > 0) {
      let searchvalues = this.searchdocumentTagValue.split(",");
      if (searchvalues.length > 1) {
        for (let index = 0; index < searchvalues.length; index++) {
          const element = searchvalues[index];
          const enumdata = this.documenttags.find(x => x.documenttagname.toUpperCase() === element.trim().toUpperCase())
          if (!enumdata) {
            this.notification.create("error", 'Error', "Invalid document tag");
            return;
          }
        }
      } else {
        const enumdata = this.documenttags.find(x => x.documenttagname.toUpperCase() === this.searchdocumentTagValue.toUpperCase())
        if (!enumdata) {
          this.notification.create("error", 'Error', "Invalid document tag");
          return;
        }
      }
      await this.loadDataFromServer({
        filter: [...this.filter.filter(x => x.key !== "documenttags"), ...[{ key: "documenttags", value: this.searchdocumentTagValue }]],
        pageindex: 1,
        pagesize: this.pageSize
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter(x => x.key !== "documenttags"),
        pageindex: 1,
        pagesize: this.pageSize
      });
    }
  }

  addTag = async (tag: string, documentid: string) => {
    this.selectedTag = undefined;
    await this.documentService.addtag(documentid, tag).toPromise();
    await this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
  }


  removeTag = async (documentid: string, tag: string) => {
    this.selectedTag = undefined;
    await this.documentService.removeTag(documentid, tag).toPromise();
    await this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
  }

  resetsearchdocumentTypeValue(): void {
    this.searchdocumentTypeValue = '';
    this.searchdocumentType();
  }

  resetsearchdocumentNameValue(): void {
    this.searchdocumentNameValue = '';
    this.searchdocumentName();
  }

  resetsearchdocumentTagValue(): void {
    this.searchdocumentTagValue = '';
    this.searchdocumentTag();
  }
}
