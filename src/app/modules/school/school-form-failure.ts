/**
 * What the school create and edit forms say when central refuses the save. Both calls opt out of the error interceptor's
 * 400, 403 and 404 notices (SchoolService), and the interceptor says nothing for a 409, so a refusal is said here, once.
 * Central names the field: a name that a school holds, or held before even if deleted, is a 409 on `schoolname` (shown under the
 * name field); a platform user changing a school's organisation is a 409 on `organisationid` (the forms have no organisation
 * picker, so it is one notice). Any other refusal is one notice, in the words the interceptor used.
 * Pure rules, no Angular; tested in Node.
 */

/** The interceptor's 404 line and notice key (error.interceptor.ts); kept equal here so this file stays free of Angular. */
const NOT_FOUND_MESSAGE = 'That record was not found. It may have been removed, or it may not be yours to see.';
const NOT_FOUND_TOAST_KEY = 'http-404';

export interface SchoolFormFailure {
  /** The sentence for the School Name field (a 400 or 409 that names `schoolname`). */
  nameError?: string;
  /** One notice for any other refusal this form words (including a 409 on `organisationid`). */
  notice?: { text: string; key?: string };
}

const NAME_REFUSED = 'Choose another name.';
const INVALID = "Some of the information isn't valid.";
const CONFLICT = 'The school could not be saved.';

const word = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function schoolFormFailure(error: { status?: number; error?: unknown }): SchoolFormFailure {
  const body = (error?.error && typeof error.error === 'object' ? error.error : {}) as {
    errormessage?: unknown;
    fields?: Array<{ field?: string; message?: unknown }>;
  };
  if (error?.status === 400 || error?.status === 409) {
    const fields = Array.isArray(body.fields) ? body.fields : [];
    const name = fields.find((f) => f?.field === 'schoolname');
    if (name) return { nameError: word(name.message) || NAME_REFUSED };
    const other = fields.find((f) => word(f?.message));
    return { notice: { text: word(body.errormessage) || word(other?.message) || (error.status === 409 ? CONFLICT : INVALID) } };
  }
  if (error?.status === 403) return { notice: { text: "You don't have permission to do that." } };
  if (error?.status === 404) return { notice: { text: word(body.errormessage) || NOT_FOUND_MESSAGE, key: NOT_FOUND_TOAST_KEY } };
  // Any other failure (500, 429, the gateway, no connection) is still the interceptor's.
  return {};
}
