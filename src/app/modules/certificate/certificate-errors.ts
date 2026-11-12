import { gatewayText } from 'src/app/interceptors/error.interceptor';
import { failureText } from './certificate';

/**
 * One sentence for a failed certificate request. A 502 or 503 is central's own sentence and its reference ("... Reference: X."),
 * without the hint (the sentence already says nothing was changed); with no sentence it is the interceptor's `gatewayText`.
 * Everything else is `failureText`.
 */
export function sayFailure(error: any, fallback: string): string {
  if (error?.status === 502 || error?.status === 503) {
    const word = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
    const said = word(error?.error?.errormessage);
    const reference = word(error?.error?.reference);
    return said ? `${said}${reference ? ` Reference: ${reference}.` : ''}` : gatewayText(error);
  }
  return failureText(error, fallback);
}
