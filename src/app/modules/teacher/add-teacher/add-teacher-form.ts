/**
 * The wording and answers of the Add teacher drawer, kept free of Angular so they can be checked in plain Node. The
 * username and password rules, the password generator and the reading of the API's field errors are the Add learner
 * drawer's, shared as they are; only the words that name a learner are replaced here.
 */
import {
  HttpFailure,
  NOT_FOUND_MESSAGE,
  NO_ACCESS_MESSAGE,
  PushStatus,
  SAVE_FAILED,
  ServerFieldErrors,
  serverFieldErrors,
} from '../../student/add-learner/add-learner-form';

export const TEACHER_USERNAME_AVAILABLE_MESSAGE = 'Available. Teachers use this to sign in on the app.';
export const TEACHER_SAVE_FAILED = "The teacher couldn't be added. Try again.";
export const TEACHER_NO_ACCESS_MESSAGE = "You don't have permission to add teachers.";
export const TEACHER_NOT_FOUND_MESSAGE = 'That school no longer exists. Close this and try again.';

/** The body keys the API names in a 400, and the form fields they belong to. */
export type TeacherFieldKey = 'schoolusername' | 'password' | 'schoolid';

export const TEACHER_FIELD_ORDER: readonly TeacherFieldKey[] = ['schoolusername', 'password', 'schoolid'];

/** The body of `POST teacher/one`: these keys and no others. */
export interface AddTeacherBody {
  schoolid: string;
  schoolusername: string;
  password: string;
}

export interface CreatedTeacher {
  schooluserid: string;
  schoolusername: string;
  push?: { status?: PushStatus; message?: string };
}

/**
 * A failed save as messages beside the fields, or one for the form. The reading is the Add learner drawer's; a field
 * this form does not have (the API names none such) is said once for the form, and the learner wording of the
 * form-level messages becomes the teacher's.
 */
export function teacherServerErrors(error: HttpFailure): { fields: Partial<Record<TeacherFieldKey, string>>; form?: string } {
  const read: ServerFieldErrors = serverFieldErrors(error);
  const fields: Partial<Record<TeacherFieldKey, string>> = {};
  let form = read.form;
  for (const [key, message] of Object.entries(read.fields)) {
    if ((TEACHER_FIELD_ORDER as readonly string[]).includes(key)) fields[key as TeacherFieldKey] = message;
    else form = form ?? message;
  }
  if (form === SAVE_FAILED) form = TEACHER_SAVE_FAILED;
  else if (form === NO_ACCESS_MESSAGE) form = TEACHER_NO_ACCESS_MESSAGE;
  else if (form === NOT_FOUND_MESSAGE) form = TEACHER_NOT_FOUND_MESSAGE;
  return form ? { fields, form } : { fields };
}

/** The line in the done panel after a 201: what the push to the learning server means for signing in. */
export function teacherSignInLine(result: Pick<CreatedTeacher, 'schoolusername' | 'push'>): { tone: 'ok' | 'warn' | 'info'; text: string } {
  const name = result.schoolusername;
  switch (result.push?.status) {
    case 'pushed':
      return { tone: 'ok', text: `${name} can sign in on the app now with these details.` };
    case 'failed':
      return {
        tone: 'warn',
        text: `${name} can't sign in yet: the learning server did not answer. Run Sync Teachers for this school on the Schools screen.`,
      };
    case 'skipped':
      return { tone: 'info', text: `${name} can sign in once the learning server next syncs.` };
    default:
      return { tone: 'info', text: `${name} was added.` };
  }
}
