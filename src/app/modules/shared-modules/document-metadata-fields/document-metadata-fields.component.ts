import { Component, Input } from '@angular/core';
import { DocumentMetadataModel, LICENCE_OPTIONS } from 'src/app/models/media-library';

/**
 * The optional details of a document: title, licence and attribution (author, source address, adapted from). Used by the
 * document page's upload and edit forms, and by the shared uploader, which shows the attribution behind an expander
 * (`compact`). It edits the object it is given; the caller sends it (see `uploadFields` / `updateBody`).
 */
@Component({
  selector: 'app-document-metadata-fields',
  templateUrl: './document-metadata-fields.component.html',
  standalone: false,
})
export class DocumentMetadataFieldsComponent {
  @Input({ required: true }) model!: DocumentMetadataModel;
  /** Attribution behind an expander instead of beside the title and licence. */
  @Input() compact = false;
  /** Makes the element ids unique when two forms are on one page. */
  @Input() idPrefix = 'document';

  readonly licences = LICENCE_OPTIONS;
}
