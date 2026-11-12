import { gatewayText } from 'src/app/interceptors/error.interceptor';
import { failureText } from './certificate';

/**
 * One sentence for a failed certificate request. A 502 or 503 is worded by the interceptor's own `gatewayText` (central's sentence,
 * its hint and "Reference: X."); everything else by `failureText`.
 */
export function sayFailure(error: any, fallback: string): string {
  return error?.status === 502 || error?.status === 503 ? gatewayText(error) : failureText(error, fallback);
}
