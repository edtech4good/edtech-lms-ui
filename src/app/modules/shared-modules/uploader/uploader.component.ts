import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzUploadFile } from 'ng-zorro-antd/upload';
import { of } from 'rxjs';
import { catchError, filter } from 'rxjs/operators';
import { IFilter } from 'src/app/models/IPaging';
import { DocumentMetadataModel, emptyMetadata, nextTitle, refusalMessage, titleFromFileName, uploadFields } from 'src/app/models/media-library';
import { setloadingAction, unsetloadingAction } from 'src/app/store/appstate/appstate.action';
import { appState } from 'src/app/store/appstate/appstate.reducer';
import { DocumentService } from '../../document/services/document.service';

@Component({
    selector: 'app-uploader',
    templateUrl: './uploader.component.html',
    styleUrls: ['./uploader.component.less'],
    standalone: false
})
export class UploaderComponent {
  showUpload = false;
  filter: Array<IFilter> = [];
  fileList: NzUploadFile[] = [];
  uploading: boolean = false;
  /** Title, licence and attribution sent with the file; the title follows the file's name until the person types one. */
  meta: DocumentMetadataModel = emptyMetadata();
  /** What the server said when it refused the upload, shown in the modal. */
  refusal = '';
  private lastPrefill = '';

  constructor(
    private documentService: DocumentService,
    private readonly notification: NzNotificationService,
    private store: Store<appState>
  ) { }


  hideuploadDocument = () => {
    this.showUpload = false;
  }

  showuploadDocument = () => {
    this.refusal = '';
    this.showUpload = true;
  }

  beforeUpload = (file: NzUploadFile): boolean => {
    // the API takes one file: a file chosen after another replaces it
    this.fileList = [file];
    this.refusal = '';
    this.meta.title = nextTitle(this.meta.title, this.lastPrefill, file.name);
    this.lastPrefill = titleFromFileName(file.name);
    return false;
  };

  private resetForm(): void {
    this.fileList = [];
    this.meta = emptyMetadata();
    this.lastPrefill = '';
    this.refusal = '';
  }

  handleUpload(): void {
    const formData = new FormData();
    this.refusal = '';
    // the optional details first, then the file
    Object.entries(uploadFields(this.meta)).forEach(([key, value]) => formData.append(key, value));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.fileList.forEach((file: any) => {
      formData.append('files[]', file);
    });
    this.uploading = true;
    this.store.dispatch(setloadingAction());
    this.documentService.upload(formData)
      .pipe(catchError((error: HttpErrorResponse) => {
        this.store.dispatch(unsetloadingAction());
        this.uploading = false;
        this.refusal = refusalMessage(error);
        return of(null);
      }), filter(e => e instanceof HttpResponse))
      .subscribe(async x => {
        this.store.dispatch(unsetloadingAction());
        this.notification.create("success", 'Success', "Document uploaded sucessfully");
        this.uploading = false;
        this.resetForm();
        this.hideuploadDocument();

      })
  }
  loadDataFromServer(arg0: { filter: any[]; pageindex: any; pagesize: any; }) {
    throw new Error('Method not implemented.');
  }

}
