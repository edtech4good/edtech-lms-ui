import { expect, test } from '@playwright/test';
import {
  MOVE_FAILED,
  MOVE_NO_ACCESS,
  MoveOption,
  SchoolRow,
  keptCurricula,
  moveBody,
  moveErrors,
  moveFormErrors,
  movedNotice,
  schoolsToMoveTo,
} from '../../src/app/modules/student/move-learner/move-learner';

/** The schools offered, the kept curricula, the request body, the notices and the reading of refusals of Move to another school (move-learner.ts), in Node. The drawer in a browser is move-learner.spec.ts. */
const SCHOOLS: SchoolRow[] = [
  { schoolid: 'a', schoolname: 'North Valley School', organisationid: 'o1' },
  { schoolid: 'b', schoolname: 'Lakeside School', organisationid: 'o1' },
  { schoolid: 'c', schoolname: 'Hilltop School', organisationid: 'o1' },
  { schoolid: 'x', schoolname: 'Far Away School', organisationid: 'o2' },
];

test.describe('schoolsToMoveTo', () => {
  test('is the learner\'s organisation\'s schools minus the current one, labelled and valued', () => {
    expect(schoolsToMoveTo(SCHOOLS, { schoolid: 'a', organisationid: 'o1' })).toEqual([
      { label: 'Lakeside School', value: 'b' },
      { label: 'Hilltop School', value: 'c' },
    ]);
  });
  test('never offers the current school', () => {
    for (const s of SCHOOLS) expect(schoolsToMoveTo(SCHOOLS, { schoolid: s.schoolid, organisationid: s.organisationid }).map((o) => o.value)).not.toContain(s.schoolid);
  });
  test('takes the organisation from the current school when the row has none', () => {
    expect(schoolsToMoveTo(SCHOOLS, { schoolid: 'b' }).map((o) => o.value)).toEqual(['a', 'c']);
  });
  test('offers nothing for another organisation\'s only school, a row with no school, or an organisation nobody knows', () => {
    expect(schoolsToMoveTo(SCHOOLS, { schoolid: 'x', organisationid: 'o2' })).toEqual([]);
    expect(schoolsToMoveTo(SCHOOLS, {})).toEqual([]);
    expect(schoolsToMoveTo(SCHOOLS, null)).toEqual([]);
    expect(schoolsToMoveTo(SCHOOLS, { schoolid: 'zzz' })).toEqual([]);
    expect(schoolsToMoveTo([], { schoolid: 'a', organisationid: 'o1' })).toEqual([]);
  });
  test('uses the row\'s own organisation over the school list\'s', () => {
    expect(schoolsToMoveTo(SCHOOLS, { schoolid: 'a', organisationid: 'o2' }).map((o) => o.value)).toEqual(['x']);
  });
});

test.describe('keptCurricula', () => {
  const available: MoveOption[] = [
    { label: 'One', value: '1' },
    { label: 'Four', value: '4' },
  ];
  test('keeps the learner\'s current curricula that the school also has, in the learner\'s order', () => {
    expect(keptCurricula(['4', '2', '1'], available)).toEqual(['4', '1']);
  });
  test('is empty when none is shared or the learner has none', () => {
    expect(keptCurricula(['2', '3'], available)).toEqual([]);
    expect(keptCurricula([], available)).toEqual([]);
  });
});

test.describe('moveBody and moveFormErrors', () => {
  test('the body has exactly three keys and copies the list', () => {
    const ids = ['1', '2'];
    const body = moveBody('b', 'class-1', ids);
    expect(body).toEqual({ schoolid: 'b', standard: 'class-1', curriculumids: ['1', '2'] });
    expect(Object.keys(body)).toEqual(['schoolid', 'standard', 'curriculumids']);
    ids.push('3');
    expect(body.curriculumids).toEqual(['1', '2']);
  });
  test('each empty field is named, each filled one is fine', () => {
    expect(moveFormErrors(null, null, [])).toEqual({ schoolid: 'Choose a school.', standard: 'Choose a class.', curriculumids: 'Choose at least one curriculum.' });
    expect(moveFormErrors('b', 'c', ['1'])).toEqual({ schoolid: null, standard: null, curriculumids: null });
  });
});

test.describe('movedNotice', () => {
  test('is central\'s sentence for each push status, with its tone', () => {
    const say = (status: 'pushed' | 'skipped' | 'failed', message: string) => movedNotice({ schoolname: 'Lakeside School', push: { status, message } });
    expect(say('pushed', 'Moved to Lakeside School. The learner signs in again to see it.')).toEqual({ type: 'success', title: 'Success', text: 'Moved to Lakeside School. The learner signs in again to see it.' });
    expect(say('skipped', 'Moved to Lakeside School. No learner server is set up here, so nothing was pushed.')).toMatchObject({ type: 'info', text: 'Moved to Lakeside School. No learner server is set up here, so nothing was pushed.' });
    const failed = say('failed', 'Moved, but the learning server did not answer. Run Sync Students for Lakeside School on the Schools screen.');
    expect(failed).toMatchObject({ type: 'warning', duration: 0, text: 'Moved, but the learning server did not answer. Run Sync Students for Lakeside School on the Schools screen.' });
  });
  test('only a failed push is kept until closed', () => {
    expect(movedNotice({ schoolname: 'X', push: { status: 'pushed', message: 'm' } }).duration).toBeUndefined();
    expect(movedNotice({ schoolname: 'X', push: { status: 'skipped', message: 'm' } }).duration).toBeUndefined();
    expect(movedNotice({ schoolname: 'X', push: { status: 'failed', message: 'm' } }).duration).toBe(0);
  });
  test('a missing sentence falls back to a plain one that names the school', () => {
    expect(movedNotice({ schoolname: 'Lakeside School', push: { status: 'pushed' } }).text).toBe('Moved to Lakeside School. The learner signs in again to see it.');
    expect(movedNotice({ schoolname: 'Lakeside School', push: { status: 'failed' } }).text).toContain('Run Sync Students for Lakeside School');
    expect(movedNotice({ schoolname: 'Lakeside School' }).text).toBe('Moved to Lakeside School.');
    expect(movedNotice({}).text).toBe('Moved to the new school.');
  });
});

test.describe('moveErrors', () => {
  test('a 400 maps each named field to its own sentence', () => {
    const out = moveErrors({
      status: 400,
      error: {
        errormessage: 'Check the highlighted fields.',
        fields: [
          { field: 'schoolid', message: 'Choose a different school.' },
          { field: 'curriculumids', message: 'Choose at least one curriculum.' },
        ],
      },
    });
    expect(out).toEqual({ fields: { schoolid: 'Choose a different school.', curriculumids: 'Choose at least one curriculum.' } });
  });
  test('a 400 field without a sentence still gets some text; a stray field becomes the form\'s', () => {
    expect(moveErrors({ status: 400, error: { fields: [{ field: 'standard' }] } }).fields.standard).toBeTruthy();
    expect(moveErrors({ status: 400, error: { fields: [{ field: 'body', message: 'Unknown field.' }] } })).toEqual({ fields: {}, form: 'Unknown field.' });
  });
  test('a 400 naming no field passes central\'s sentence on', () => {
    expect(moveErrors({ status: 400, error: { errormessage: 'Choose an organisation.' } })).toEqual({ fields: {}, form: 'Choose an organisation.' });
  });
  test('404, 409 and 5xx pass central\'s own sentence through', () => {
    for (const status of [404, 409, 500, 502, 503]) {
      expect(moveErrors({ status, error: { errormessage: `Central says ${status}.` } })).toEqual({ fields: {}, form: `Central says ${status}.` });
    }
  });
  test('without a sentence a fixed one is used; a 403 says permission', () => {
    expect(moveErrors({ status: 500, error: '<html>' })).toEqual({ fields: {}, form: MOVE_FAILED });
    expect(moveErrors({ status: 0 })).toEqual({ fields: {}, form: MOVE_FAILED });
    expect(moveErrors({ status: 403, error: {} })).toEqual({ fields: {}, form: MOVE_NO_ACCESS });
    expect(moveErrors({ status: 409, error: { errormessage: '   ' } }).form).toBe(MOVE_FAILED);
  });
});
