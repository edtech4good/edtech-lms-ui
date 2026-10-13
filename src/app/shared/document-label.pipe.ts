import { Pipe, PipeTransform } from '@angular/core';
import { documentLabel } from '../models/media-library';

/** A document's label wherever it is listed or picked: its title, else its name (the storage key). Values stay `documentname`. */
@Pipe({ name: 'documentLabel' })
export class DocumentLabelPipe implements PipeTransform {
  transform(doc: { documenttitle?: string | null; documentname?: string | null } | null | undefined): string {
    return documentLabel(doc);
  }
}
