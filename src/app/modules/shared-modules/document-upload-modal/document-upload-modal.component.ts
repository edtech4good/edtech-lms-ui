import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { Store } from '@ngrx/store';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzUploadFile } from 'ng-zorro-antd/upload';
import { DocumentMetadataModel, emptyMetadata, refusalLine, refusalNotices, titleFromFileName } from 'src/app/models/media-library';
import { setloadingAction, unsetloadingAction } from 'src/app/store/appstate/appstate.action';
import { appState } from 'src/app/store/appstate/appstate.reducer';
import { DocumentService } from '../../document/services/document.service';

/** One chosen file, its own title (prefilled from its name, editable), and what the server said if it refused it. */
export interface UploadEntry {
  file: File;
  title: string;
  /** "<file name>: <the server's message>"; the server's messages never carry the name, so it is put in front. */
  error?: string;
}

/**
 * The upload dialog of the document page and of the shared uploader. One or more files: each is posted alone
 * (`POST /document/upload` takes one file per request), in order, with the batch's licence and attribution and its own
 * title. A refused file stays in the list with the server's message, and the batch goes on past it.
 */
@Component({
  selector: 'app-document-upload-modal',
  templateUrl: './document-upload-modal.component.html',
  styleUrls: ['./document-upload-modal.component.less'],
  standalone: false,
})
export class DocumentUploadModalComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** Attribution behind an expander (the shared uploader's compact form). */
  @Input() compact = false;
  @Input() idPrefix = 'upload';
  /** After a batch in which at least one file was stored: how many. */
  @Output() uploaded = new EventEmitter<number>();

  entries: UploadEntry[] = [];
  meta: DocumentMetadataModel = emptyMetadata();
  uploading = false;

  constructor(
    private readonly documentService: DocumentService,
    private readonly notification: NzNotificationService,
    private readonly store: Store<appState>,
    private readonly cd: ChangeDetectorRef
  ) {}

  beforeUpload = (file: NzUploadFile): boolean => {
    this.entries = [...this.entries, { file: file as unknown as File, title: titleFromFileName(file.name) }];
    // the host may be OnPush: say that this view changed
    this.cd.markForCheck();
    return false;
  };

  remove(entry: UploadEntry): void {
    this.entries = this.entries.filter((e) => e !== entry);
    this.cd.markForCheck();
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  async submit(): Promise<void> {
    if (this.entries.length === 0 || this.uploading) return;
    this.uploading = true;
    this.cd.markForCheck();
    this.store.dispatch(setloadingAction());
    const batch = this.entries.map((e) => ({ ...e, error: undefined }));
    this.entries = batch;
    const results = await this.documentService.uploadEach(batch, this.meta);
    this.store.dispatch(unsetloadingAction());
    this.uploading = false;
    this.cd.markForCheck();
    const refused = results.filter((r) => r.error);
    const stored = results.length - refused.length;
    if (stored > 0) {
      this.notification.create('success', 'Success', stored === 1 ? 'Document uploaded sucessfully' : `${stored} documents uploaded sucessfully`);
    }
    for (const html of refusalNotices(refused.map((r) => ({ name: r.file.name, message: r.error as string })))) {
      this.notification.create('error', 'Error', html);
    }
    // what was stored leaves the list; what was refused stays, with its line
    this.entries = refused.map((r) => ({ file: r.file, title: r.title, error: refusalLine(r.file.name, r.error as string) }));
    this.cd.markForCheck();
    if (stored > 0) this.uploaded.emit(stored);
    if (this.entries.length === 0) {
      this.meta = emptyMetadata();
      this.close();
    }
  }
}
