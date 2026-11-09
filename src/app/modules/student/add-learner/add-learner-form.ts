
/**
 * The rules and wording of the Add learner drawer, kept free of Angular so they can be checked in plain Node.
 * The server decides every rule; these checks only say the same thing sooner, in the same words.
 */

/** What the admin calls a learner's group. Today every screen says "Class"; a per-organisation word is a later setting. */
export const CLASS_WORD = 'Class';
export const CLASS_WORD_PLURAL = `${CLASS_WORD}es`;

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 16;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 32;

export const USERNAME_RULE_MESSAGE = 'Use 2 to 16 English letters or numbers.';
export const PASSWORD_RULE_MESSAGE = 'Use 8 to 32 characters with at least one letter and one number, and no spaces.';
export const USERNAME_AVAILABLE_MESSAGE = 'Available. Learners use this to sign in.';
export const USERNAME_TAKEN_MESSAGE = 'That username is taken.';
export const FORM_INVALID_MESSAGE = "Some of the information isn't valid. Check the form and try again.";
export const SAVE_FAILED = "The learner couldn't be added. Try again.";
export const NO_ACCESS_MESSAGE = "You don't have permission to add learners.";
export const GENDER_MESSAGE = 'Choose a gender.';
export const DATE_OF_BIRTH_MESSAGE = 'Enter a date of birth between 1900 and yesterday.';
export const NO_CURRICULA_MESSAGE = 'This school has no curricula yet.';
/** Shown under the class field when a school has none. */
export const noClassesMessage = (): string => `This school has no ${CLASS_WORD_PLURAL.toLowerCase()} yet. Add one on the Schools screen.`;
export const NOT_FOUND_MESSAGE = 'That school or class no longer exists. Close this and try again.';

const USERNAME_PATTERN = /^[A-Za-z0-9]+$/;

/** The body keys the API names in a 400, and the form fields they belong to. */
export type FieldKey =
  | 'studentfirstname'
  | 'studentlastname'
  | 'schoolusername'
  | 'password'
  | 'schoolid'
  | 'standard'
  | 'curriculumids'
  | 'genderid'
  | 'dateofbirth';

export const FIELD_ORDER: readonly FieldKey[] = [
  'studentfirstname',
  'studentlastname',
  'schoolusername',
  'password',
  'schoolid',
  'standard',
  'curriculumids',
  'genderid',
  'dateofbirth',
];

export function usernameError(value: string): string | null {
  if (!value) return 'Enter a username.';
  if (!USERNAME_PATTERN.test(value) || value.length < USERNAME_MIN || value.length > USERNAME_MAX) {
    return USERNAME_RULE_MESSAGE;
  }
  return null;
}

export function passwordError(value: string): string | null {
  if (!value) return 'Enter a password.';
  const length = [...value].length;
  if (length < PASSWORD_MIN || length > PASSWORD_MAX || /\s/u.test(value) || !/\p{L}/u.test(value) || !/[0-9]/.test(value)) {
    return PASSWORD_RULE_MESSAGE;
  }
  return null;
}

/** Names are stored in 45-character columns. */
export const NAME_MAX = 45;
export const FIRST_NAME_MESSAGE = `Enter a name of 2 to ${NAME_MAX} characters.`;
export const LAST_NAME_MESSAGE = `Enter a name of 1 to ${NAME_MAX} characters.`;

export function firstNameError(value: string): string | null {
  const length = [...value.trim()].length;
  return length >= 2 && length <= NAME_MAX ? null : FIRST_NAME_MESSAGE;
}

/** Optional: empty is fine; a name that is given is 1 to 45 characters. */
export function lastNameError(value: string): string | null {
  const length = [...value.trim()].length;
  return length === 0 || length <= NAME_MAX ? null : LAST_NAME_MESSAGE;
}

// ---- Date of birth -------------------------------------------------------------------------------------------------

export const DATE_OF_BIRTH_MIN = '1900-01-01';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Yesterday on the admin's own calendar: the latest date of birth central accepts. */
export function yesterdayOf(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return isoDate(d);
}

/**
 * Optional: empty is fine. A date that is partly typed (`badInput`, as a date input reports it), not a real date, before
 * 1900 or not yet in the past is refused here in the same terms as central.
 */
export function dateOfBirthError(value: string, badInput = false, now: Date = new Date()): string | null {
  if (badInput) return DATE_OF_BIRTH_MESSAGE;
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return DATE_OF_BIRTH_MESSAGE;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const real = new Date(y, m - 1, d);
  if (real.getFullYear() !== y || real.getMonth() !== m - 1 || real.getDate() !== d) return DATE_OF_BIRTH_MESSAGE;
  return value >= DATE_OF_BIRTH_MIN && value <= yesterdayOf(now) ? null : DATE_OF_BIRTH_MESSAGE;
}

// ---- Generate ----------------------------------------------------------------------------------------------------

/** Short, common, easy-to-read English words (all lower case, 4 to 6 letters). */
export const PASSWORD_WORDS: readonly string[] = [
  'river', 'lamp', 'cloud', 'maple', 'tiger', 'bread', 'stone', 'ocean', 'sunny', 'apple',
  'green', 'happy', 'moon', 'garden', 'bridge', 'candle', 'forest', 'window', 'pencil', 'rabbit',
  'silver', 'yellow', 'orange', 'bottle', 'planet', 'basket', 'summer', 'winter', 'flower', 'market',
  'island', 'ladder', 'mango', 'melon', 'paper', 'train', 'water', 'wheel', 'horse', 'field',
];

/** A random integer in [0, max) from `crypto.getRandomValues`, without modulo bias. */
export function randomBelow(max: number, fill: (a: Uint32Array) => Uint32Array = (a) => crypto.getRandomValues(a)): number {
  if (!Number.isInteger(max) || max < 1 || max > 0x100000000) throw new RangeError('max out of range');
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  for (;;) {
    const value = fill(buffer)[0];
    if (value < limit) return value % max;
  }
}

/** Two different short words and two digits, all lower case, such as "riverlamp47". Always meets the password rule. */
export function generatePassword(below: (max: number) => number = randomBelow): string {
  const first = below(PASSWORD_WORDS.length);
  let second = below(PASSWORD_WORDS.length - 1);
  if (second >= first) second += 1;
  const digits = below(100).toString().padStart(2, '0');
  return `${PASSWORD_WORDS[first]}${PASSWORD_WORDS[second]}${digits}`;
}

// ---- The API's answers ---------------------------------------------------------------------------------------------

export interface ApiErrorBody {
  code?: string;
  errormessage?: string;
  fields?: Array<{ field?: string; message?: string }>;
}

export interface ServerFieldErrors {
  fields: Partial<Record<FieldKey, string>>;
  /** Something that belongs to no field (no organisation chosen, a refusal). */
  form?: string;
}

/** Shown beside a field the API names when it gave no sentence of its own. */
const FALLBACK_FIELD_MESSAGES: Record<FieldKey, string> = {
  studentfirstname: FIRST_NAME_MESSAGE,
  studentlastname: LAST_NAME_MESSAGE,
  schoolusername: USERNAME_RULE_MESSAGE,
  password: PASSWORD_RULE_MESSAGE,
  schoolid: 'Choose a school.',
  standard: `Choose a ${CLASS_WORD.toLowerCase()} of this school.`,
  curriculumids: 'Choose at least one curriculum of this school.',
  genderid: GENDER_MESSAGE,
  dateofbirth: DATE_OF_BIRTH_MESSAGE,
};

/**
 * Turn a failed save into messages beside the fields, or one for the form. A 400 names its fields and the API's own
 * sentence is shown (it is written for users). Statuses the error interceptor toasts (no connection, 429, 500) say
 * nothing here, so a failure is one message.
 */
/** The two parts of a failed request this reads; Angular's HttpErrorResponse fits it, and plain Node specs can build one. */
export interface HttpFailure {
  status: number;
  error?: unknown;
}

export function serverFieldErrors(error: HttpFailure): ServerFieldErrors {
  const out: ServerFieldErrors = { fields: {} };
  if ([0, 429, 500].includes(error.status)) return out;
  const body = (error.error && typeof error.error === 'object' ? error.error : {}) as ApiErrorBody;
  if (error.status === 404) {
    // A missing school or class is named by the field, such as "That school doesn't exist." beside School.
    for (const f of Array.isArray(body.fields) ? body.fields : []) {
      const key = FIELD_ORDER.find((k) => k === f?.field);
      if (key && typeof f.message === 'string' && f.message.trim()) out.fields[key] = f.message;
    }
    if (Object.keys(out.fields).length === 0) out.form = NOT_FOUND_MESSAGE;
    return out;
  }
  if (error.status === 400) {
    for (const f of Array.isArray(body.fields) ? body.fields : []) {
      // The username check names its field `username`; the form's key for it is `schoolusername`.
      const named = f?.field === 'username' ? 'schoolusername' : f?.field;
      const key = FIELD_ORDER.find((k) => k === named);
      if (key) {
        out.fields[key] = typeof f.message === 'string' && f.message.trim() ? f.message : FALLBACK_FIELD_MESSAGES[key];
      } else {
        out.form = FORM_INVALID_MESSAGE;
      }
    }
    if (Object.keys(out.fields).length === 0 && !out.form) {
      // No field named, as when a platform account has not chosen an organisation: the API's sentence is for the form.
      out.form = typeof body.errormessage === 'string' && body.errormessage.trim() ? body.errormessage : FORM_INVALID_MESSAGE;
    }
    return out;
  }
  if (error.status === 403) out.form = NO_ACCESS_MESSAGE;
  else if (error.status === 502 || error.status === 503) return out; // the interceptor's gateway notice says it
  else out.form = SAVE_FAILED;
  return out;
}

/** The body of `POST student/one`: these keys and no others (the optional ones are left out when empty). */
export interface AddLearnerBody {
  schoolid: string;
  standard: string;
  curriculumids: string[];
  studentfirstname: string;
  studentlastname?: string;
  schoolusername: string;
  password: string;
  genderid: 1 | 2;
  dateofbirth?: string;
}

export type PushStatus = 'pushed' | 'failed' | 'skipped';

/** Central's own sentence for a failed push (it says which sync to run), trimmed; empty when it gave none. */
export const pushMessageOf = (push?: { message?: string }): string => (typeof push?.message === 'string' ? push.message.trim() : '');

export interface CreatedLearner {
  schooluserid: string;
  schoolusername: string;
  studentname: string;
  push?: { status?: PushStatus; message?: string };
}

/** The line in the done panel after a 201: what the push to the learning server means for signing in. */
export function signInLine(result: Pick<CreatedLearner, 'studentname' | 'push'>): { tone: 'ok' | 'warn' | 'info'; text: string } {
  const name = result.studentname;
  switch (result.push?.status) {
    case 'pushed':
      return { tone: 'ok', text: `${name} can sign in now with these details.` };
    case 'failed':
      return {
        tone: 'warn',
        text: `${name} can't sign in yet: ${pushMessageOf(result.push) || 'the learning server did not answer. Run Sync Students for this school on the Schools screen.'}`,
      };
    case 'skipped':
      return { tone: 'info', text: `${name} can sign in once the learning server next syncs.` };
    default:
      return { tone: 'info', text: `${name} was added.` };
  }
}
