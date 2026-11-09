import { expect, test } from '@playwright/test';
import {
  CLASS_WORD_PLURAL,
  PASSWORD_RULE_MESSAGE,
  PASSWORD_WORDS,
  USERNAME_RULE_MESSAGE,
  DATE_OF_BIRTH_MESSAGE,
  dateOfBirthError,
  noClassesMessage,
  signInLine,
  yesterdayOf,
  generatePassword,
  passwordError,
  randomBelow,
  serverFieldErrors,
  usernameError,
  firstNameError,
  lastNameError,
  type HttpFailure,
} from '../../src/app/modules/student/add-learner/add-learner-form';

/** The Add learner drawer's rules and wording (add-learner-form.ts), in Node. The drawer in a browser is add-learner.spec.ts. */
const failure = (status: number, error?: unknown) => ({ status, error }) as HttpFailure;

test.describe('the username rule', () => {
  test('accepts 2 to 16 English letters and digits', () => {
    for (const ok of ['ab', 'Sokha1', '12', 'a'.repeat(16), 'Z9']) expect(usernameError(ok), ok).toBeNull();
  });
  test('says the rule for anything else', () => {
    for (const bad of ['a', 'a'.repeat(17), 'has space', 'dot.name', 'under_score', 'សុខា', 'é1', '-a']) {
      expect(usernameError(bad), bad).toBe(USERNAME_RULE_MESSAGE);
    }
    expect(usernameError('')).toBe('Enter a username.');
  });
});

test.describe('the name rules', () => {
  test('a first name is 2 to 45 characters, counted as letters not bytes', () => {
    for (const ok of ['សុខា', 'x'.repeat(45), ' សុខា ', 'ស'.repeat(45)]) expect(firstNameError(ok), ok).toBeNull();
    for (const bad of ['', ' ', 'ស', 'x'.repeat(46), 'ស'.repeat(46)]) expect(firstNameError(bad), bad).toBe('Enter a name of 2 to 45 characters.');
  });
  test('a last name is optional, and 1 to 45 characters when given', () => {
    for (const ok of ['', '  ', 'ច', 'ស'.repeat(45)]) expect(lastNameError(ok), ok).toBeNull();
    expect(lastNameError('x'.repeat(46))).toBe('Enter a name of 1 to 45 characters.');
  });
});

test.describe('the words', () => {
  test('the username rule and the no-classes line say what the design says', () => {
    expect(USERNAME_RULE_MESSAGE).toBe('Use 2 to 16 English letters or numbers.');
    expect(CLASS_WORD_PLURAL).toBe('Classes');
    expect(noClassesMessage()).toBe('This school has no classes yet. Add one on the Schools screen.');
  });
});

test.describe('the date of birth rule', () => {
  const now = new Date(2026, 10, 8); // 8 November 2026
  test('yesterday is the latest date, on the admin’s own calendar', () => {
    expect(yesterdayOf(now)).toBe('2026-11-07');
    expect(yesterdayOf(new Date(2026, 0, 1))).toBe('2025-12-31');
    expect(yesterdayOf(new Date(2024, 2, 1))).toBe('2024-02-29');
  });
  test('accepts empty, 1900-01-01 and yesterday', () => {
    for (const ok of ['', '1900-01-01', '2014-03-05', '2026-11-07']) expect(dateOfBirthError(ok, false, now), ok).toBeNull();
  });
  test('refuses a date before 1900, today, the future, a date that is not real, and a half-typed one', () => {
    for (const bad of ['1899-12-31', '2026-11-08', '2999-01-01', '2014-02-30', '20140-03-05', '2014-3-5', 'x']) {
      expect(dateOfBirthError(bad, false, now), bad).toBe(DATE_OF_BIRTH_MESSAGE);
    }
    expect(dateOfBirthError('', true, now)).toBe(DATE_OF_BIRTH_MESSAGE);
    expect(DATE_OF_BIRTH_MESSAGE).toBe('Enter a date of birth between 1900 and yesterday.');
  });
});

test.describe('the password rule', () => {
  test('accepts 8 to 32 characters with a letter and a number and no spaces', () => {
    for (const ok of ['abcdefg1', 'riverlamp47', 'A1' + 'x'.repeat(30), 'pass-word-9', 'សុខាសុខា12']) expect(passwordError(ok), ok).toBeNull();
  });
  test('only the digits 0 to 9 count as a number, as on central', () => {
    expect(passwordError('abcdefgh១២')).toBe(PASSWORD_RULE_MESSAGE);
    expect(passwordError('abcdefgh7')).toBeNull();
  });
  test('says the rule for a short, long, spaced, letterless or numberless one', () => {
    for (const bad of ['abcdefg', 'a1', 'A1' + 'x'.repeat(31), 'has space1', '12345678', 'abcdefgh', 'abcd efg1', ' abcdefg1', 'abcdefgh១២', 'abcdefgh٣']) {
      expect(passwordError(bad), bad).toBe(PASSWORD_RULE_MESSAGE);
    }
    expect(passwordError('')).toBe('Enter a password.');
  });
});

test.describe('Generate', () => {
  test('always makes two different lower-case words and two digits that pass the rule', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const value = generatePassword();
      seen.add(value);
      expect(value, value).toMatch(/^[a-z]+[0-9]{2}$/);
      expect(passwordError(value), value).toBeNull();
      const words = PASSWORD_WORDS.filter((w) => value.startsWith(w));
      const pair = words.find((first) => PASSWORD_WORDS.some((second) => second !== first && value === `${first}${second}${value.slice(-2)}`));
      expect(pair, `${value} is two different listed words and two digits`).toBeTruthy();
    }
    expect(seen.size, 'they vary').toBeGreaterThan(4000);
  });
  test('the word list is short, common-looking and lower case', () => {
    for (const w of PASSWORD_WORDS) expect(w, w).toMatch(/^[a-z]{4,6}$/);
    expect(new Set(PASSWORD_WORDS).size).toBe(PASSWORD_WORDS.length);
  });
  test('draws from the random source it is given, covering every word and digit pair', () => {
    expect(generatePassword((max) => 0)).toBe(`${PASSWORD_WORDS[0]}${PASSWORD_WORDS[1]}00`);
    expect(generatePassword((max) => max - 1)).toBe(`${PASSWORD_WORDS[PASSWORD_WORDS.length - 1]}${PASSWORD_WORDS[PASSWORD_WORDS.length - 2]}99`);
  });
  test('randomBelow stays in range and throws away values that would bias it', () => {
    for (let i = 0; i < 2000; i++) {
      const n = randomBelow(100);
      expect(n >= 0 && n < 100 && Number.isInteger(n)).toBe(true);
    }
    // 2^32 is not a multiple of 3; the top value is refused and the next draw is used.
    const draws = [0xffffffff, 7];
    expect(randomBelow(3, (a) => ((a[0] = draws.shift()!), a))).toBe(1);
    expect(() => randomBelow(0)).toThrow();
  });
});

test.describe('what a failed save says', () => {
  const body = (fields: Array<{ field: string; message?: string }>) => ({ error: true, code: 'INVALID_INPUT', errormessage: 'Bad.', fields });

  test('a 400 puts the API’s own sentence on the field it names', () => {
    const out = serverFieldErrors(
      failure(400, body([
        { field: 'schoolusername', message: 'That username is taken.' },
        { field: 'password', message: PASSWORD_RULE_MESSAGE },
        { field: 'standard', message: 'Choose a class of this school.' },
      ])),
    );
    expect(out).toEqual({
      fields: { schoolusername: 'That username is taken.', password: PASSWORD_RULE_MESSAGE, standard: 'Choose a class of this school.' },
    });
  });
  test('every body key maps to its own field', () => {
    for (const key of ['studentfirstname', 'studentlastname', 'schoolusername', 'password', 'schoolid', 'standard', 'curriculumids', 'genderid', 'dateofbirth']) {
      expect(serverFieldErrors(failure(400, body([{ field: key, message: `about ${key}` }]))).fields, key).toEqual({ [key]: `about ${key}` });
    }
  });
  test('a field with no sentence gets a plain one; a field the form lacks goes to the form', () => {
    expect(serverFieldErrors(failure(400, body([{ field: 'password' }]))).fields.password).toBe(PASSWORD_RULE_MESSAGE);
    expect(serverFieldErrors(failure(400, body([{ field: 'password', message: '  ' }]))).fields.password).toBe(PASSWORD_RULE_MESSAGE);
    const out = serverFieldErrors(failure(400, body([{ field: 'somethingelse', message: 'x' }])));
    expect(out.fields).toEqual({});
    expect(out.form).toBe("Some of the information isn't valid. Check the form and try again.");
  });
  test('a 400 with no field says the API’s sentence for the form', () => {
    expect(serverFieldErrors(failure(400, { errormessage: 'Choose an organisation.' }))).toEqual({ fields: {}, form: 'Choose an organisation.' });
    expect(serverFieldErrors(failure(400, 'text')).form).toBe("Some of the information isn't valid. Check the form and try again.");
    expect(serverFieldErrors(failure(400)).form).toBe("Some of the information isn't valid. Check the form and try again.");
  });
  test('no connection, 429 and 500 say nothing here (the interceptor toasts them)', () => {
    for (const status of [0, 429, 500, 502, 503]) expect(serverFieldErrors(failure(status, { errormessage: 'x' })), String(status)).toEqual({ fields: {} });
  });
  test('the username check names its field `username`, which is the username field', () => {
    expect(serverFieldErrors(failure(400, body([{ field: 'username', message: USERNAME_RULE_MESSAGE }]))).fields).toEqual({ schoolusername: USERNAME_RULE_MESSAGE });
  });
  test('a 404 that names the school puts its sentence under School; one that names nothing says one line for the form', () => {
    expect(serverFieldErrors(failure(404, body([{ field: 'schoolid', message: "That school doesn't exist." }])))).toEqual({
      fields: { schoolid: "That school doesn't exist." },
    });
    expect(serverFieldErrors(failure(404, { errormessage: 'Not found' })).form).toBe('That school or class no longer exists. Close this and try again.');
  });
  test('403, 404 and anything else say one line for the form', () => {
    expect(serverFieldErrors(failure(403)).form).toBe("You don't have permission to add learners.");
    expect(serverFieldErrors(failure(404)).form).toBe('That school or class no longer exists. Close this and try again.');
    expect(serverFieldErrors(failure(409)).form).toBe("The learner couldn't be added. Try again.");
  });
});


/** Central's two real sentences for a push that failed: the learning server did not answer, or it lacks the class or curriculum. */
const CENTRAL_SYNC_MESSAGE = "The account was saved, but the learning server did not answer. Run Sync Students for this school on the Schools screen.";
const CENTRAL_MISSING_MESSAGE = "Saved, but the learning server doesn't have this class or curriculum yet. Run Sync Content, then Sync Students for this school.";

test.describe('the line in the done panel', () => {
  const learner = { studentname: 'សុខា ចាន់' };
  test('says what the push means for signing in', () => {
    expect(signInLine({ ...learner, push: { status: 'pushed', message: '' } })).toEqual({ tone: 'ok', text: 'សុខា ចាន់ can sign in now with these details.' });
    expect(signInLine({ ...learner, push: { status: 'failed', message: 'The account was saved, but the learning server did not answer.' } })).toEqual({
      tone: 'warn',
      text: "សុខា ចាន់ can't sign in yet: The account was saved, but the learning server did not answer.",
    });
    // Central's own sentence follows the lead-in, whichever of its two it is; without one the fixed line is used.
    for (const message of [CENTRAL_SYNC_MESSAGE, CENTRAL_MISSING_MESSAGE]) {
      expect(signInLine({ ...learner, push: { status: 'failed', message: `  ${message}  ` } })).toEqual({ tone: 'warn', text: `សុខា ចាន់ can't sign in yet: ${message}` });
    }
    expect(signInLine({ ...learner, push: { status: 'failed', message: '   ' } }).text).toBe(
      "សុខា ចាន់ can't sign in yet: the learning server did not answer. Run Sync Students for this school on the Schools screen.",
    );
    expect(signInLine({ ...learner, push: { status: 'failed' } }).text).toBe(
      "សុខា ចាន់ can't sign in yet: the learning server did not answer. Run Sync Students for this school on the Schools screen.",
    );
    expect(signInLine({ ...learner, push: { status: 'skipped', message: '' } })).toEqual({
      tone: 'info',
      text: 'សុខា ចាន់ can sign in once the learning server next syncs.',
    });
  });
  test('promises nothing when the push is missing or unknown', () => {
    expect(signInLine(learner)).toEqual({ tone: 'info', text: 'សុខា ចាន់ was added.' });
    expect(signInLine({ ...learner, push: { status: 'other' as never } })).toEqual({ tone: 'info', text: 'សុខា ចាន់ was added.' });
  });
});
