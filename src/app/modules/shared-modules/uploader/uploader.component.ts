import { Component, computed, inject } from '@angular/core';
import { IFilter } from 'src/app/models/IPaging';
import { OrgContextService } from '../../shell/org-context.service';
import { CHOOSE_ORGANISATION_NOTICE, needsOrganisation } from '../../shell/org-context';

/**
 * The "Upload" link of the question and lesson forms: it opens the shared upload dialog
 * (`app-document-upload-modal`: one or more files, each posted alone with its own title, and the licence and
 * attribution of the batch).
 */
@Component({
    selector: 'app-uploader',
    templateUrl: './uploader.component.html',
    styleUrls: ['./uploader.component.less'],
    standalone: false
})
export class UploaderComponent {
  showUpload = false;
  filter: Array<IFilter> = [];
  private readonly orgContext = inject(OrgContextService);
  /** The platform view with no organisation chosen: every upload would be refused, so the button says so up front. */
  readonly uploadBlocked = computed(() => needsOrganisation(this.orgContext.claims()));
  readonly chooseOrganisationNotice = CHOOSE_ORGANISATION_NOTICE;

  showuploadDocument = () => {
    this.showUpload = true;
  }

  loadDataFromServer(arg0: { filter: any[]; pageindex: any; pagesize: any; }) {
    throw new Error('Method not implemented.');
  }
}
