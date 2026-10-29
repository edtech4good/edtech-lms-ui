import { HttpErrorResponse } from '@angular/common/http';
import { gatewayText } from 'src/app/interceptors/error.interceptor';
import { Refusal, UNREACHABLE_MESSAGE } from './publication.model';

/**
 * The words for a refusal that is not the publish drawer's own to show beside its content: the 502 and 503 take the API's
 * sentence, hint and reference (`gatewayText`, the one text the interceptor and the organisation list use), status 0 takes
 * the unreachable line.
 */
export function gatewayWords(error: HttpErrorResponse): string {
  return error.status === 0 ? UNREACHABLE_MESSAGE : gatewayText(error);
}

/** One sentence for any refusal (a toast): the API's words, its hint after them. A missing row is the caller's to say. */
export function refusalText(refusal: Refusal, error: HttpErrorResponse): string {
  switch (refusal.kind) {
    case 'invalid':
      return [refusal.message, refusal.hint].filter((t) => t !== '').join(' ');
    case 'gateway':
      return gatewayWords(error);
    case 'missing':
      return 'It no longer exists.';
    default:
      return refusal.message;
  }
}
