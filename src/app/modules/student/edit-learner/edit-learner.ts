/**
 * The request, the wording and the reading of failures for Edit details on the Learners list, kept free of Angular so
 * they can be checked in plain Node. The requests are `GET student/:schooluserid/details` and
 * `PUT student/:schooluserid/details` with the six keys of `EditLearnerBody`. The field rules and their messages are the
 * Add learner drawer's, imported as they are.
 */
import { FIELD_ORDER, FieldKey, HttpFailure, PushStatus, serverFieldErrors } from '../add-learner/add-learner-form';

export const NO_LONGER_AVAILABLE = '(no longer available)';
export const EDIT_NO_ACCESS_MESSAGE = "You don't have permission to edit learners.";
export const EDIT_NOT_FOUND_MESSAGE = 'That learner no longer exists. Close this and try again.';
export const EDIT_SAVE_FAILED = "The details couldn't be saved. Try again.";
export const EDIT_LOAD_FAILED = "The learner's details couldn't be loaded.";
export const CLASS_UNAVAILABLE_NOTE = 'The current class is no longer available. Choose another one to save.';
export const CURRICULUM_UNAVAILABLE_NOTE = 'A curriculum marked (no longer available) must be removed before you save.';

/** What `GET student/:schooluserid/details` answers. */
export interface LearnerDetails {
  schooluserid: string;
  schoolusername: string;
  schoolid: string;
  schoolname: string;
  studentfirstname: string;
  studentlastname: string;
  genderid: number | null;
  /** "YYYY-MM-DD" or null. */
  dateofbirth: string | null;
  /** The id of the learner's class. */
  standard: string;
  curriculumids: string[];
  isdisabled: boolean;
}

/** The body of `PUT student/:schooluserid/details`: these six keys and no others, all always present. */
export interface EditLearnerBody {
  studentfirstname: string;
  studentlastname: string;
  genderid: 1 | 2;
  dateofbirth: string | null;
  standard: string;
  curriculumids: string[];
}

export interface EditLearnerResult {
  schooluserid: string;
  studentname: string;
  push?: { status?: PushStatus; message?: string };
}

/** The values the form holds, as the drawer keeps them. */
export interface EditForm {
  firstName: string;
  lastName: string;
  genderId: number | null;
  /** "YYYY-MM-DD", or "" for none. */
  dateOfBirth: string;
  standardId: string | null;
  curriculumIds: string[];
}

export interface Option {
  label: string;
  value: string;
}

export function formFromDetails(details: LearnerDetails): EditForm {
  return {
    firstName: details.studentfirstname ?? '',
    lastName: details.studentlastname ?? '',
    genderId: details.genderid === 1 || details.genderid === 2 ? details.genderid : null,
    dateOfBirth: details.dateofbirth ?? '',
    standardId: details.standard || null,
    curriculumIds: [...(details.curriculumids ?? [])],
  };
}

/** The request body for a valid form (the caller has checked the form: gender and class are chosen). */
export function editBody(form: EditForm): EditLearnerBody {
  return {
    studentfirstname: form.firstName.trim(),
    studentlastname: form.lastName.trim(),
    genderid: form.genderId as 1 | 2,
    dateofbirth: form.dateOfBirth ? form.dateOfBirth : null,
    standard: form.standardId as string,
    curriculumids: [...form.curriculumIds],
  };
}

const normal = (form: EditForm) => ({
  first: form.firstName.trim(),
  last: form.lastName.trim(),
  gender: form.genderId,
  dob: form.dateOfBirth || '',
  standard: form.standardId || '',
  curricula: [...form.curriculumIds].sort().join('|'),
});

/** Whether the form differs from what was loaded: names without their outer spaces, the curricula as a set. */
export function isChanged(initial: EditForm, current: EditForm): boolean {
  return JSON.stringify(normal(initial)) !== JSON.stringify(normal(current));
}

/**
 * The options with one more for each chosen value the list no longer has (a class or curriculum deleted since), shown as
 * "(no longer available)" so the person can see why a choice is refused. Gone once the choice is changed.
 */
export function withUnavailable(options: Option[], chosen: Array<string | null | undefined>): Option[] {
  const known = new Set(options.map((o) => o.value));
  const extra = chosen.filter((v): v is string => !!v && !known.has(v));
  return [...options, ...[...new Set(extra)].map((value) => ({ label: NO_LONGER_AVAILABLE, value }))];
}

/** The chosen values the list does not have. */
export function unavailableOf(options: Option[], chosen: Array<string | null | undefined>): string[] {
  const known = new Set(options.map((o) => o.value));
  return chosen.filter((v): v is string => !!v && !known.has(v));
}

export interface SavedNotice {
  type: 'success' | 'warning' | 'info';
  title: string;
  text: string;
}

/** The toast after a 200: what the push to the learning server means. */
export function savedNotice(result: Pick<EditLearnerResult, 'studentname' | 'push'>, fallbackName = 'The learner'): SavedNotice {
  const name = result.studentname && result.studentname.trim() ? result.studentname : fallbackName;
  switch (result.push?.status) {
    case 'pushed':
      return { type: 'success', title: 'Success', text: `${name}'s details are saved.` };
    case 'failed':
      return {
        type: 'warning',
        title: 'Saved',
        text: 'Saved, but the learning server did not answer. Run Sync Students for this school on the Schools screen.',
      };
    case 'skipped':
      return { type: 'info', title: 'Saved', text: 'Saved. The learning server gets the change at its next sync.' };
    default:
      return { type: 'info', title: 'Saved', text: `${name} was updated.` };
  }
}

/** The fields of a failed save: those the API names beside their fields, and one sentence for the form. */
export function editErrors(error: HttpFailure): { fields: Partial<Record<FieldKey, string>>; form?: string } {
  const read = serverFieldErrors(error);
  if (error.status === 404 && Object.keys(read.fields).length === 0) return { fields: {}, form: EDIT_NOT_FOUND_MESSAGE };
  if (error.status === 403) return { fields: {}, form: EDIT_NO_ACCESS_MESSAGE };
  if (error.status === 400) {
    // A field that is not on this form (no organisation chosen) is named by the API in its own words.
    const body = (error.error && typeof error.error === 'object' ? error.error : {}) as { fields?: Array<{ field?: string; message?: string }> };
    const stray = (Array.isArray(body.fields) ? body.fields : []).find((f) => !FIELD_ORDER.some((k) => k === f?.field) && typeof f?.message === 'string' && f.message.trim());
    if (stray && Object.keys(read.fields).length === 0) return { fields: {}, form: stray.message };
    return read;
  }
  if (read.form && ![404].includes(error.status)) return { fields: read.fields, form: EDIT_SAVE_FAILED };
  return read;
}

/** The sentence when the details could not be loaded. */
export function loadFailure(error: HttpFailure): string {
  if (error.status === 404) return EDIT_NOT_FOUND_MESSAGE;
  if (error.status === 403) return EDIT_NO_ACCESS_MESSAGE;
  return EDIT_LOAD_FAILED;
}
