import { Component, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzUploadFile } from 'ng-zorro-antd/upload';
import { IFilter } from 'src/app/models/IPaging';
import { DocumentMetadataModel, emptyMetadata, failureText, nextTitle, titleFromFileName } from 'src/app/models/media-library';
import { setloadingAction, unsetloadingAction } from 'src/app/store/appstate/appstate.action';
import { appState } from 'src/app/store/appstate/appstate.reducer';
import { DocumentService } from '../../document/services/document.service';
import { OrgContextService } from '../../shell/org-context.service';
import { CHOOSE_ORGANISATION_NOTICE, needsOrganisation } from '../../shell/org-context';

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
  private readonly orgContext = inject(OrgContextService);
  /** The platform view with no organisation chosen: every upload would be refused, so the button says so up front. */
  readonly uploadBlocked = computed(() => needsOrganisation(this.orgContext.claims()));
  readonly chooseOrganisationNotice = CHOOSE_ORGANISATION_NOTICE;

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
    this.fileList = this.fileList.concat(file);
    this.refusal = '';
    if (this.fileList.length === 1) {
      this.meta.title = nextTitle(this.meta.title, this.lastPrefill, file.name);
      this.lastPrefill = titleFromFileName(file.name);
    } else if (this.meta.title === this.lastPrefill) {
      // one title cannot name several files: each file's name is its title
      this.meta.title = '';
      this.lastPrefill = '';
    }
    return false;
  };

  /** One title cannot name several files. */
  get titleLocked(): boolean {
    return this.fileList.length > 1;
  }

  private resetForm(): void {
    this.fileList = [];
    this.meta = emptyMetadata();
    this.lastPrefill = '';
    this.refusal = '';
  }

  /** One request per file, in order; the files the server refused stay in the list with its message for each. */
  async handleUpload(): Promise<void> {
    this.refusal = '';
    this.uploading = true;
    this.store.dispatch(setloadingAction());
    const files = this.fileList as unknown as File[];
    const results = await this.documentService.uploadEach(files, this.meta);
    this.store.dispatch(unsetloadingAction());
    this.uploading = false;
    const refused = results.filter((r) => r.error);
    const uploaded = results.length - refused.length;
    if (uploaded > 0) {
      this.notification.create("success", 'Success', uploaded > 1 ? "Documents uploaded sucessfully" : "Document uploaded sucessfully");
    }
    if (refused.length === 0) {
      this.resetForm();
      this.hideuploadDocument();
      return;
    }
    this.fileList = refused.map((r) => r.file) as unknown as NzUploadFile[];
    this.refusal = failureText(refused.map((r) => ({ name: r.file.name, message: r.error as string })), results.length);
  }
    loadDataFromServer(arg0: { filter: any[]; pageindex: any; pagesize: any; }) {
    throw new Error('Method not implemented.');
  }

}
