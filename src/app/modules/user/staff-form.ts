import { HttpErrorResponse } from '@angular/common/http';
import { Role } from 'src/app/models/enums/role.enum';

/** What a staff form says when the API refuses or cannot save, in the API's own cases. */
export const STAFF_SAVE_FAILED = "The account couldn't be saved. Try again.";
export const FORBIDDEN_DEFAULT = "You don't have permission to do that.";
export const STAFF_NOT_FOUND = "That person doesn't exist, or isn't in your organisation.";
export const NO_ORGANISATION_NOTE = 'A platform account has no organisation.';
export const CHOOSE_ORGANISATION = 'Choose the organisation this account belongs to.';
export const OWN_ROLES_CONFIRM = 'Changing your own roles signs you out. Continue?';
export const SIGN_IN_LOCKED_NOTE = "Only platform staff can change this person's sign-in details.";
export const MARKED_ROLES_NOTE = "Roles marked * can't be given back by you if you remove them.";

export type StaffField = 'lmsusername' | 'lmsuserpasswordhash' | 'lmsuserroles' | 'organisationid' | 'countryids' | 'schoolids';

export interface StaffErrors {
  fields: Partial<Record<StaffField, string>>;
  /** A message for the whole form; absent when the failure is shown on fields or by the interceptor. */
  form?: string;
}

/** The statuses the error interceptor already puts in a toast (429, 500, no connection): saying it again would be a second message. */
const TOASTED_BY_INTERCEPTOR: readonly number[] = [0, 429, 500];

const FIELD_MESSAGES: Record<Exclude<StaffField, 'organisationid'>, string> = {
  lmsusername: 'Enter an email address of at most 45 characters.',
  lmsuserpasswordhash: 'Use 8 to 50 characters with an uppercase letter, a lowercase letter and a number, and no spaces.',
  lmsuserroles: 'Choose at least one role.',
  countryids: 'Check the country.',
  schoolids: 'Check the school.',
};

/** The one sentence the API gives for an email that is taken. */
const API_EMAIL_TAKEN = 'already registered';

const isField = (name: string): name is StaffField =>
  name === 'organisationid' || name in FIELD_MESSAGES;

/**
 * Turn a failed staff create or update into messages beside the fields, or one for
 * the form. One message per failure: what the interceptor already toasts says nothing here.
 *
 * - 400 names its fields. The organisation's own messages are the API's (they are
 *   written for people), "already registered" stays the API's sentence on the email
 *   field, and the rest are ours.
 * - 409 is an email that is already registered (the API's sentence, on the email field), else its message for the form.
 * - 403 is the API's wording when it has some, else the generic line.
 * - 404 means the account is gone or is not in the caller's organisation.
 * - Anything else (401, 502, 503, ...) is the generic "couldn't be saved" line.
 */
export function serverStaffErrors(error: HttpErrorResponse): StaffErrors {
  const out: StaffErrors = { fields: {} };
  if (TOASTED_BY_INTERCEPTOR.includes(error.status)) {
    return out;
  }
  const body = (error.error ?? {}) as { errormessage?: unknown; fields?: Array<{ field?: string; message?: string }> };
  const said = typeof body.errormessage === 'string' ? body.errormessage.trim() : '';
  if (error.status === 400) {
    for (const f of body.fields ?? []) {
      const name = f.field ?? '';
      if (name === 'lmsusername' && (f.message ?? '').includes(API_EMAIL_TAKEN)) {
        out.fields.lmsusername = f.message;
      } else if (name === 'organisationid') {
        out.fields.organisationid = f.message?.trim() || CHOOSE_ORGANISATION;
      } else if (isField(name)) {
        out.fields[name] = FIELD_MESSAGES[name as Exclude<StaffField, 'organisationid'>];
      } else {
        out.form = "Some of the information isn't valid. Check the form and try again.";
      }
    }
    if (Object.keys(out.fields).length === 0 && !out.form) {
      out.form = "Some of the information isn't valid. Check the form and try again.";
    }
    return out;
  }
  if (error.status === 409) {
    // An email that is taken is a 409 with the API's own sentence and no field list.
    if (said.includes(API_EMAIL_TAKEN)) {
      out.fields.lmsusername = said;
    } else {
      out.form = said || STAFF_SAVE_FAILED;
    }
    return out;
  }
  if (error.status === 403) {
    out.form = said || FORBIDDEN_DEFAULT;
  } else if (error.status === 404) {
    out.form = STAFF_NOT_FOUND;
  } else {
    out.form = STAFF_SAVE_FAILED;
  }
  return out;
}

/** Does this role set include Super Admin (a platform account: no organisation)? */
export const holdsSuperAdmin = (roleIds: readonly string[]): boolean => roleIds.includes(Role.superadmin);

/** The order the fields appear in: focus goes to the first with a message. */
export const STAFF_FIELD_ORDER: StaffField[] = ['lmsusername', 'lmsuserpasswordhash', 'organisationid', 'countryids', 'schoolids', 'lmsuserroles'];

/**
 * A message about the organisation, when the form has no Organisation select to put it on (the
 * caller works inside an organisation, or the page was read in another context than the token's
 * now is), is said for the whole form: a field error nobody can see would be silence.
 */
export function organisationErrorForForm(errors: StaffErrors, selectShown: boolean): StaffErrors {
  const said = errors.fields.organisationid;
  if (selectShown || !said) return errors;
  const { organisationid, ...fields } = errors.fields;
  return { fields, form: errors.form ?? said };
}
