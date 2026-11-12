import { expect, test } from '@playwright/test';
import {
  RECOGNITION_TIERS,
  changedRecognition,
  readFailure,
  recognitionDefaultsFor,
  recognitionToCreate,
  showsLevelCertificateNote,
  storedRecognition,
} from '../../src/app/modules/curriculum/curriculum-recognition';

/**
 * The curriculum form's recognition rules (src/app/modules/curriculum/curriculum-recognition.ts), in Node. No browser, no API:
 * what each tier offers, the preset defaults, what edit and create send, and how a refused save is read. The 400's body is the
 * one central answers (edtech-lms-api curriculum-recognition.spec.ts: `fields: [{ field, message }]`).
 */
const ALLOWED = (label: string) => `${label} must be one of the allowed values.`;
const refusal = (fields: Array<{ field: string; message: string }>) => ({
  error: true, data: false, code: 'INVALID_INPUT', errormessage: "Some of the information isn't valid.", hint: 'Check the highlighted fields.', fields,
});

test.describe('the tiers', () => {
  test('a level offers Nothing, Award, Certificate; a grade and the curriculum never offer Award', () => {
    const by = Object.fromEntries(RECOGNITION_TIERS.map((t) => [t.field, t.options.map((o) => o.value)]));
    expect(by).toEqual({
      levelrecognition: ['none', 'award', 'certificate'],
      graderecognition: ['none', 'certificate'],
      curriculumrecognition: ['none', 'certificate'],
    });
    expect(RECOGNITION_TIERS.map((t) => t.label)).toEqual(['Level', 'Grade', 'Curriculum']);
  });

  test('a certificate is labelled as not issued yet', () => {
    for (const tier of RECOGNITION_TIERS) {
      expect(tier.options.find((o) => o.value === 'certificate')?.label).toBe('Certificate (not issued yet)');
    }
  });

  test('the level note shows for a level set to certificate only', () => {
    expect(showsLevelCertificateNote('certificate')).toBe(true);
    for (const v of ['none', 'award', null]) expect(showsLevelCertificateNote(v)).toBe(false);
  });
});

test.describe('the preset defaults', () => {
  test('company: award / none / certificate; a school network, any other or unknown preset: award / certificate / none', () => {
    expect(recognitionDefaultsFor('company')).toEqual({ levelrecognition: 'award', graderecognition: 'none', curriculumrecognition: 'certificate' });
    for (const p of ['schoolnetwork', 'school', 'other', '', null, undefined]) {
      expect(recognitionDefaultsFor(p)).toEqual({ levelrecognition: 'award', graderecognition: 'certificate', curriculumrecognition: 'none' });
    }
  });
});

test.describe('what is sent', () => {
  const stored = storedRecognition({ levelrecognition: 'award', graderecognition: 'none', curriculumrecognition: 'certificate' });

  test('edit preselects the stored values; a missing value is null, never a guess', () => {
    expect(stored).toEqual({ levelrecognition: 'award', graderecognition: 'none', curriculumrecognition: 'certificate' });
    expect(storedRecognition({ levelrecognition: 'award' })).toEqual({ levelrecognition: 'award', graderecognition: null, curriculumrecognition: null });
    expect(storedRecognition(null)).toEqual({ levelrecognition: null, graderecognition: null, curriculumrecognition: null });
  });

  test('edit sends only the tiers the person changed', () => {
    expect(changedRecognition(stored, { ...stored })).toEqual({});
    expect(changedRecognition(stored, { ...stored, levelrecognition: 'certificate' })).toEqual({ levelrecognition: 'certificate' });
    expect(changedRecognition(stored, { levelrecognition: 'none', graderecognition: 'certificate', curriculumrecognition: 'certificate' })).toEqual({
      levelrecognition: 'none',
      graderecognition: 'certificate',
    });
  });

  test('create sends the three values shown; with the preset unknown it sends nothing', () => {
    const shown = recognitionDefaultsFor('company');
    expect(recognitionToCreate(shown, true)).toEqual(shown);
    expect(recognitionToCreate(shown, false)).toEqual({});
    expect(recognitionToCreate({ levelrecognition: null, graderecognition: null, curriculumrecognition: null }, true)).toEqual({});
  });
});

test.describe('a refused save', () => {
  test('a 400 naming graderecognition is that select\'s sentence and no toast', () => {
    const body = refusal([{ field: 'graderecognition', message: ALLOWED('Graderecognition') }]);
    expect(readFailure({ status: 400, error: body })).toEqual({ fields: { graderecognition: ALLOWED('Graderecognition') }, toast: null });
  });

  test('the first sentence for a tier wins when it is named twice', () => {
    const body = refusal([
      { field: 'levelrecognition', message: ALLOWED('Levelrecognition') },
      { field: 'levelrecognition', message: "Levelrecognition can't be empty." },
    ]);
    expect(readFailure({ status: 400, error: body }).fields).toEqual({ levelrecognition: ALLOWED('Levelrecognition') });
  });

  test('a 400 on another field is a toast with the API sentence; mixed, both are shown', () => {
    const other = refusal([{ field: 'Curriculum Name', message: 'Curriculum Name is too short.' }]);
    expect(readFailure({ status: 400, error: other })).toEqual({ fields: {}, toast: "Some of the information isn't valid." });
    const mixed = refusal([{ field: 'curriculumrecognition', message: ALLOWED('Curriculumrecognition') }, { field: 'subjectid', message: 'x' }]);
    const read = readFailure({ status: 400, error: mixed });
    expect(read.fields).toEqual({ curriculumrecognition: ALLOWED('Curriculumrecognition') });
    expect(read.toast).toBe("Some of the information isn't valid.");
  });

  test('a 409 (a duplicate name) is a toast with the API sentence, its own words or the default', () => {
    const body = { error: true, data: false, code: 'ALREADY_EXISTS', errormessage: 'That curriculum already exists.' };
    expect(readFailure({ status: 409, error: body })).toEqual({ fields: {}, toast: 'That curriculum already exists.' });
    expect(readFailure({ status: 409, error: {} }).toast).toBe('That curriculum already exists.');
  });

  test('a 404 toast carries the interceptor\'s key, so a repeat replaces it', () => {
    expect(readFailure({ status: 404, error: {} }, 'http-404').toastKey).toBe('http-404');
  });

  test('a 403 and a 404 are said here (the opt-out silenced the interceptor); 0, 429, 500 and gateway failures are left to it', () => {
    expect(readFailure({ status: 403, error: {} }).toast).toBe("You don't have permission to do that.");
    expect(readFailure({ status: 404, error: { errormessage: 'No such curriculum.' } }).toast).toBe('No such curriculum.');
    for (const status of [0, 429, 500, 502, 503]) expect(readFailure({ status, error: {} })).toEqual({ fields: {}, toast: null });
  });
});
