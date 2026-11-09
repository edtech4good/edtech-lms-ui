import { expect, test } from '@playwright/test';
import {
  CLASS_UNAVAILABLE_NOTE,
  EDIT_LOAD_FAILED,
  EDIT_NOT_FOUND_MESSAGE,
  EDIT_NO_ACCESS_MESSAGE,
  EDIT_SAVE_FAILED,
  EditForm,
  LearnerDetails,
  NO_LONGER_AVAILABLE,
  editBody,
  editErrors,
  formFromDetails,
  isChanged,
  loadFailure,
  savedNotice,
  unavailableOf,
  withUnavailable,
} from '../../src/app/modules/student/edit-learner/edit-learner';

/** The request body, the "changed" check, the toast lines and the "(no longer available)" rule of Edit details (edit-learner.ts), in Node. The drawer in a browser is edit-learner.spec.ts. */
/** Central's two real sentences for a push that failed: the learning server did not answer, or it lacks the class or curriculum. */
const CENTRAL_SYNC_MESSAGE = "The account was saved, but the learning server did not answer. Run Sync Students for this school on the Schools screen.";
const CENTRAL_MISSING_MESSAGE = "Saved, but the learning server doesn't have this class or curriculum yet. Run Sync Content, then Sync Students for this school.";

const details: LearnerDetails = {
  schooluserid: 'lu-1',
  schoolusername: 'dara1',
  schoolid: 'school-a',
  schoolname: 'North Valley School',
  studentfirstname: 'សុខា',
  studentlastname: 'Rivers',
  genderid: 2,
  dateofbirth: '2014-05-06',
  standard: 'class-a1',
  curriculumids: ['cur-1', 'cur-2'],
  isdisabled: false,
};
const loaded = (): EditForm => formFromDetails(details);

test.describe('the request body', () => {
  test('is exactly the six keys, in the contract\'s shape', () => {
    const body = editBody(loaded());
    expect(Object.keys(body).sort()).toEqual(['curriculumids', 'dateofbirth', 'genderid', 'standard', 'studentfirstname', 'studentlastname']);
    expect(body).toEqual({
      studentfirstname: 'សុខា',
      studentlastname: 'Rivers',
      genderid: 2,
      dateofbirth: '2014-05-06',
      standard: 'class-a1',
      curriculumids: ['cur-1', 'cur-2'],
    });
  });
  test('an empty last name stays "" and an empty date of birth is null; every key is still there', () => {
    const body = editBody({ ...loaded(), lastName: '   ', dateOfBirth: '' });
    expect(body.studentlastname).toBe('');
    expect(body.dateofbirth).toBeNull();
    expect(Object.keys(body)).toHaveLength(6);
  });
  test('names are sent without their outer spaces', () => {
    expect(editBody({ ...loaded(), firstName: '  Dara  ' }).studentfirstname).toBe('Dara');
  });
  test('a learner with no date of birth loads as an empty field', () => {
    expect(formFromDetails({ ...details, dateofbirth: null }).dateOfBirth).toBe('');
  });
});

test.describe('the changed check', () => {
  test('the loaded values are not a change', () => {
    expect(isChanged(loaded(), loaded())).toBe(false);
  });
  test('outer spaces and the order of curricula are not a change', () => {
    expect(isChanged(loaded(), { ...loaded(), firstName: ' សុខា ', curriculumIds: ['cur-2', 'cur-1'] })).toBe(false);
  });
  for (const [what, change] of [
    ['first name', { firstName: 'សុខា។' }],
    ['last name', { lastName: '' }],
    ['gender', { genderId: 1 }],
    ['date of birth', { dateOfBirth: '' }],
    ['class', { standardId: 'class-a2' }],
    ['a curriculum removed', { curriculumIds: ['cur-1'] }],
    ['a curriculum added', { curriculumIds: ['cur-1', 'cur-2', 'cur-3'] }],
  ] as Array<[string, Partial<EditForm>]>) {
    test(`${what} is a change`, () => {
      expect(isChanged(loaded(), { ...loaded(), ...change })).toBe(true);
    });
  }
  test('going back to the loaded value is no longer a change', () => {
    const edited = { ...loaded(), standardId: 'class-a2' };
    expect(isChanged(loaded(), edited)).toBe(true);
    expect(isChanged(loaded(), { ...edited, standardId: 'class-a1' })).toBe(false);
  });
});

test.describe('the toast after a 200', () => {
  test('pushed', () => {
    expect(savedNotice({ studentname: 'Dara Rivers', push: { status: 'pushed' } })).toEqual({ type: 'success', title: 'Success', text: "Dara Rivers's details are saved." });
  });
  test("failed shows central's own sentence, trimmed, whichever of its two it is", () => {
    for (const message of [CENTRAL_SYNC_MESSAGE, CENTRAL_MISSING_MESSAGE]) {
      expect(savedNotice({ studentname: 'Dara Rivers', push: { status: 'failed', message: ` ${message} ` } })).toEqual({ type: 'warning', title: 'Saved', text: message });
    }
  });
  test('failed with no sentence', () => {
    expect(savedNotice({ studentname: 'Dara Rivers', push: { status: 'failed', message: ' ' } }).text).toContain('Run Sync Students');
    expect(savedNotice({ studentname: 'Dara Rivers', push: { status: 'failed' } })).toEqual({
      type: 'warning',
      title: 'Saved',
      text: 'Saved, but the learning server did not answer. Run Sync Students for this school on the Schools screen.',
    });
  });
  test('skipped', () => {
    expect(savedNotice({ studentname: 'Dara Rivers', push: { status: 'skipped' } })).toEqual({
      type: 'info',
      title: 'Saved',
      text: 'Saved. The learning server gets the change at its next sync.',
    });
  });
  test('anything else, or no push at all', () => {
    expect(savedNotice({ studentname: 'Dara Rivers' }).text).toBe('Dara Rivers was updated.');
    expect(savedNotice({ studentname: 'Dara Rivers', push: { status: 'unknown' as any } }).text).toBe('Dara Rivers was updated.');
  });
  test('a Khmer name is used as it comes', () => {
    expect(savedNotice({ studentname: 'សុខា Rivers', push: { status: 'pushed' } }).text).toBe("សុខា Rivers's details are saved.");
  });
  test('an answer without a name falls back to the name typed', () => {
    expect(savedNotice({ studentname: '', push: { status: 'pushed' } }, 'Dara Rivers').text).toBe("Dara Rivers's details are saved.");
  });
});

test.describe('"(no longer available)"', () => {
  const classes = [
    { label: 'Class 1A', value: 'class-a1' },
    { label: 'Class 2A', value: 'class-a2' },
  ];
  test('a chosen value the list has adds nothing', () => {
    expect(withUnavailable(classes, ['class-a1'])).toEqual(classes);
    expect(unavailableOf(classes, ['class-a1'])).toEqual([]);
  });
  test('a chosen value the list lacks is added with the plain label', () => {
    expect(withUnavailable(classes, ['class-gone'])).toEqual([...classes, { label: NO_LONGER_AVAILABLE, value: 'class-gone' }]);
    expect(unavailableOf(classes, ['class-gone'])).toEqual(['class-gone']);
    expect(NO_LONGER_AVAILABLE).toBe('(no longer available)');
  });
  test('only the missing ones among several are added, once each', () => {
    const got = withUnavailable(classes, ['class-a1', 'cur-x', 'cur-x', 'cur-y']);
    expect(got.filter((o) => o.label === NO_LONGER_AVAILABLE).map((o) => o.value)).toEqual(['cur-x', 'cur-y']);
  });
  test('nothing chosen adds nothing', () => {
    expect(withUnavailable(classes, [null, undefined, ''])).toEqual(classes);
    expect(CLASS_UNAVAILABLE_NOTE).toContain('no longer available');
  });
});

test.describe('failures', () => {
  test('a 400 names its fields beside them in the API\'s own words', () => {
    const got = editErrors({ status: 400, error: { fields: [{ field: 'studentfirstname', message: 'Enter a name of 2 to 45 characters.' }, { field: 'standard', message: 'Choose a class for this student.' }] } });
    expect(got).toEqual({ fields: { studentfirstname: 'Enter a name of 2 to 45 characters.', standard: 'Choose a class for this student.' } });
  });
  test('a 400 with no organisation chosen is one sentence for the form', () => {
    expect(editErrors({ status: 400, error: { fields: [{ field: 'schooluserid', message: 'Choose an organisation.' }] } })).toEqual({ fields: {}, form: 'Choose an organisation.' });
  });
  test('a 404 without fields says the learner is gone; a 403 says no permission', () => {
    expect(editErrors({ status: 404, error: {} })).toEqual({ fields: {}, form: EDIT_NOT_FOUND_MESSAGE });
    expect(editErrors({ status: 403 })).toEqual({ fields: {}, form: EDIT_NO_ACCESS_MESSAGE });
  });
  test('another status says the save failed; 0, 429 and 500 are left to the interceptor', () => {
    expect(editErrors({ status: 409 }).form).toBe(EDIT_SAVE_FAILED);
    for (const status of [0, 429, 500]) expect(editErrors({ status })).toEqual({ fields: {} });
  });
  test('loading failures', () => {
    expect(loadFailure({ status: 404 })).toBe(EDIT_NOT_FOUND_MESSAGE);
    expect(loadFailure({ status: 403 })).toBe(EDIT_NO_ACCESS_MESSAGE);
    expect(loadFailure({ status: 500 })).toBe(EDIT_LOAD_FAILED);
    expect(loadFailure({ status: 400, error: { errormessage: 'Invalid input.', fields: [{ field: 'schooluserid', message: 'Choose an organisation.' }] } })).toBe('Choose an organisation.');
    expect(loadFailure({ status: 400, error: { errormessage: 'Choose an organisation.' } })).toBe('Choose an organisation.');
    expect(loadFailure({ status: 400, error: {} })).toBe(EDIT_LOAD_FAILED);
  });
});
