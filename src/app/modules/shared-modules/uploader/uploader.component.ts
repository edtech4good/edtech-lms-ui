import { HttpResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzUploadFile } from 'ng-zorro-antd/upload';
import { of } from 'rxjs';
import { catchError, filter } from 'rxjs/operators';
import { IFilter } from 'src/app/models/IPaging';
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

  constructor(
    private documentService: DocumentService,
    private readonly notification: NzNotificationService,
    private store: Store<appState>
  ) { }


  hideuploadDocument = () => {
    this.showUpload = false;
  }

  showuploadDocument = () => {
    this.showUpload = true;
  }

  beforeUpload = (file: NzUploadFile): boolean => {
    this.fileList = this.fileList.concat(file);
    return false;
  };

  handleUpload(): void {
    const formData = new FormData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.fileList.forEach((file: any) => {
      formData.append('files[]', file);
    });
    this.uploading = true;
    this.store.dispatch(setloadingAction());
    this.documentService.upload(formData)
      .pipe(catchError(() => {
        this.store.dispatch(unsetloadingAction());
        this.uploading = false;
        return of(null);
      }), filter(e => e instanceof HttpResponse))
      .subscribe(async x => {
        this.store.dispatch(unsetloadingAction());
        this.notification.create("success", 'Success', "Document uploaded sucessfully");
        this.uploading = false;
        this.fileList = [];
        this.hideuploadDocument();

      })
  }
  loadDataFromServer(arg0: { filter: any[]; pageindex: any; pagesize: any; }) {
    throw new Error('Method not implemented.');
  }

}
