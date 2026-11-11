import { expect, test } from '@playwright/test';
import { asksForSyncContent, pushOf } from '../../src/app/shared/notices/notice-rules';
import { heldLabel, isOffered, splitCurricula } from '../../src/app/shared/publication/published-curricula';
import { schoolFormFailure } from '../../src/app/modules/school/school-form-failure';

/**
 * The pure rules behind the sync-after-write screens, in plain Node: which curricula a learner form offers, what the school
 * forms say for a refusal, when a refused sync links to Sync Content, and where a save's `push` sits in central's answer.
 */
const NAME_TAKEN = 'A school with this name existed before. Choose another name.';
const MOVE = "A school can't be moved to another organisation yet. Create the school in the other organisation instead.";

test.describe('published curricula', () => {
  test('only never and withdrawn hide a curriculum; a state that is missing leaves it offered', () => {
    expect(isOffered('published')).toBe(true);
    expect(isOffered('never')).toBe(false);
    expect(isOffered('withdrawn')).toBe(false);
    expect(isOffered(undefined)).toBe(true);
    expect(isOffered(null)).toBe(true);
  });

  test('a held unpublished curriculum is labelled by its state', () => {
    expect(heldLabel('Reading', 'withdrawn')).toBe('Reading (retired)');
    expect(heldLabel('Reading', 'never')).toBe('Reading (not published)');
    expect(heldLabel('Reading', 'published')).toBe('Reading');
  });

  test('splitCurricula offers the published ones, keeps the held unpublished ones, and drops deleted rows', () => {
    const rows = [
      { curriculumid: 'a', curriculumname: 'Alpha', publicationstatus: 'published' },
      { curriculumid: 'b', curriculumname: 'Beta', publicationstatus: 'withdrawn' },
      { curriculumid: 'c', curriculumname: 'Gamma', publicationstatus: 'never' },
      { curriculumid: 'd', curriculumname: 'Delta' },
      { curriculumid: 'gone' },
      { curriculumid: 'x', curriculumname: 'Xi', isdeleted: true, publicationstatus: 'published' },
    ];
    const { offered, held } = splitCurricula(rows, ['b']);
    expect(offered).toEqual([
      { label: 'Alpha', value: 'a' },
      { label: 'Delta', value: 'd' },
    ]);
    expect(held).toEqual([{ label: 'Beta (retired)', value: 'b' }]);
    expect(splitCurricula(rows, []).held).toEqual([]);
  });
});

test.describe('school form refusals', () => {
  test('a 409 or 400 that names schoolname goes under the name field', () => {
    for (const status of [400, 409]) {
      expect(schoolFormFailure({ status, error: { errormessage: NAME_TAKEN, fields: [{ field: 'schoolname', message: NAME_TAKEN }] } })).toEqual({ nameError: NAME_TAKEN });
    }
    expect(schoolFormFailure({ status: 409, error: { fields: [{ field: 'schoolname' }] } })).toEqual({ nameError: 'Choose another name.' });
  });

  test('a 409 on organisationid is one notice with central\'s words', () => {
    expect(schoolFormFailure({ status: 409, error: { errormessage: MOVE, fields: [{ field: 'organisationid', message: MOVE }] } })).toEqual({ notice: { text: MOVE } });
    expect(schoolFormFailure({ status: 409, error: {} })).toEqual({ notice: { text: 'The school could not be saved.' } });
  });

  test('403, 404 and other 400s are one notice; anything else is the interceptor\'s', () => {
    expect(schoolFormFailure({ status: 403 })).toEqual({ notice: { text: "You don't have permission to do that." } });
    expect(schoolFormFailure({ status: 404, error: { errormessage: 'No such school.' } })).toEqual({ notice: { text: 'No such school.', key: 'http-404' } });
    expect(schoolFormFailure({ status: 400, error: { errormessage: 'Bad.' } })).toEqual({ notice: { text: 'Bad.' } });
    expect(schoolFormFailure({ status: 400, error: {} })).toEqual({ notice: { text: "Some of the information isn't valid." } });
    for (const status of [0, 429, 500, 502, 503]) expect(schoolFormFailure({ status })).toEqual({});
  });
});

test.describe('refused sync and push', () => {
  test('only the sentence that sends the person to Sync Content gets the link', () => {
    expect(asksForSyncContent("The learning server doesn't have this school or one of its classes yet. Run Sync Content, then Sync Students.")).toBe(true);
    expect(asksForSyncContent("A curriculum these learners use isn't on the learning server. Publish it, then Sync Students.")).toBe(false);
    expect(asksForSyncContent('The sync was refused.')).toBe(false);
  });

  test('push is read beside data, and only there', () => {
    const push = { status: 'failed', message: 'x' };
    expect(pushOf({ error: false, data: true, push })).toEqual(push);
    expect(pushOf({ error: false, data: { push } })).toBeUndefined();
    expect(pushOf({ error: false, data: true })).toBeUndefined();
    expect(pushOf(undefined)).toBeUndefined();
    expect(pushOf(null)).toBeUndefined();
  });
});
