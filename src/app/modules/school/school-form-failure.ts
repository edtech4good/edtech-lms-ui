/**
 * What the school create and edit forms say when central refuses the save. Both calls opt out of the error interceptor's
 * 400, 403 and 404 notices (SchoolService), so a refusal is said here, once: a school name central refuses (one a school held
 * before, even a deleted one) goes under the name field; any other refusal is one notice, in the words the interceptor used.
 * Pure rules, no Angular; tested in Node.
 */
import { NOT_FOUND_MESSAGE, NOT_FOUND_TOAST_KEY } from 'src/app/interceptors/error.interceptor';

export interface SchoolFormFailure {
  /** The sentence for the School Name field (a 400 that names `schoolname`). */
  nameError?: string;
  /** One notice for any other refusal this form words. */
  notice?: { text: string; key?: string };
}

const NAME_REFUSED = 'Choose another name.';
const INVALID = "Some of the information isn't valid.";

const word = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function schoolFormFailure(error: { status?: number; error?: unknown }): SchoolFormFailure {
  const body = (error?.error && typeof error.error === 'object' ? error.error : {}) as {
    errormessage?: unknown;
    fields?: Array<{ field?: string; message?: unknown }>;
  };
  if (error?.status === 400) {
    const name = (Array.isArray(body.fields) ? body.fields : []).find((f) => f?.field === 'schoolname');
    if (name) return { nameError: word(name.message) || NAME_REFUSED };
    return { notice: { text: word(body.errormessage) || INVALID } };
  }
  if (error?.status === 403) return { notice: { text: "You don't have permission to do that." } };
  if (error?.status === 404) return { notice: { text: word(body.errormessage) || NOT_FOUND_MESSAGE, key: NOT_FOUND_TOAST_KEY } };
  // Any other failure (500, 429, the gateway, no connection) is still the interceptor's.
  return {};
}
