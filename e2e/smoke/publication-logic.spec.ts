import { expect, test } from '@playwright/test';
import {
  CONFLICT_MESSAGE,
  NO_PERMISSION_MESSAGE,
  PillSource,
  SUCCESS_TOAST_MS,
  pillDate,
  pillOf,
  pushMessage,
  pushToast,
  refusalOf,
} from '../../src/app/shared/publication/publication.model';

/**
 * The publish screens' rules (src/app/shared/publication/publication.model.ts), in Node. No browser, no API: which pill a
 * curriculum shows, what a push makes of a toast, and what a refused publish or retire means. The behaviour against the
 * central API is in curriculum-publish.spec.ts.
 */

const NOON = new Date(2026, 9, 29, 12, 0, 0).toISOString(); // 29 Oct 2026, local noon: the same day in every time zone

const source = (over: Partial<PillSource>): PillSource => ({ publicationstatus: 'never', publishedat: null, changedsincepublish: false, problem: null, ...over });

test.describe('the publication pill', () => {
  test('never published', () => {
    expect(pillOf(source({}))).toEqual({ kind: 'never', text: 'Never published', title: null });
  });

  test('published says the day, in the form the list shows', () => {
    expect(pillOf(source({ publicationstatus: 'published', publishedat: NOON }))).toEqual({ kind: 'published', text: 'Published 29 Oct 2026', title: null });
    expect(pillDate(NOON)).toBe('29 Oct 2026');
  });

  test('published without a usable date says Published and no day', () => {
    expect(pillOf(source({ publicationstatus: 'published', publishedat: null })).text).toBe('Published');
    expect(pillOf(source({ publicationstatus: 'published', publishedat: 'not a date' })).text).toBe('Published');
    expect(pillDate(undefined)).toBe('');
  });

  test('changed since publish only for a curriculum that is published', () => {
    expect(pillOf(source({ publicationstatus: 'published', publishedat: NOON, changedsincepublish: true }))).toEqual({
      kind: 'changed',
      text: 'Changed since publish',
      title: null,
    });
    // a retired or never published curriculum is not "changed since publish", whatever the flag says
    expect(pillOf(source({ publicationstatus: 'withdrawn', changedsincepublish: true })).kind).toBe('retired');
    expect(pillOf(source({ publicationstatus: 'never', changedsincepublish: true })).kind).toBe('never');
  });

  test('the API\'s withdrawn is shown as Retired', () => {
    expect(pillOf(source({ publicationstatus: 'withdrawn' }))).toEqual({ kind: 'retired', text: 'Retired', title: null });
  });

  test('a problem comes first and carries the API\'s words as its hover text', () => {
    const said = 'This curriculum can\'t be published yet. lessons: 1 row hangs from a row that is not in this curriculum.';
    expect(pillOf(source({ publicationstatus: 'published', publishedat: NOON, changedsincepublish: true, problem: said }))).toEqual({
      kind: 'problem',
      text: "Can't be published",
      title: said,
    });
    // an empty problem is no problem
    expect(pillOf(source({ problem: '  ' })).kind).toBe('never');
  });

  test('the map\'s tree carries no changed flag: published is just published', () => {
    const tree = { publicationstatus: 'published' as const, publishedat: NOON };
    expect(pillOf(tree).kind).toBe('published');
  });
});

test.describe('what a push makes of a toast', () => {
  test('a failed push is an error that stays', () => {
    expect(pushToast({ status: 'failed', message: 'x' })).toEqual({ type: 'error', duration: 0 });
  });

  test('pushed, skipped and no push at all are success toasts that go after six seconds', () => {
    expect(SUCCESS_TOAST_MS).toBe(6000);
    for (const push of [{ status: 'pushed' as const, message: 'x' }, { status: 'skipped' as const, message: 'x' }, null, undefined]) {
      expect(pushToast(push)).toEqual({ type: 'success', duration: 6000 });
    }
  });

  test('the message is the API\'s sentence, trimmed; none when the answer had no push', () => {
    expect(pushMessage({ status: 'skipped', message: '  Published. Nothing was pushed.  ' })).toBe('Published. Nothing was pushed.');
    expect(pushMessage(null)).toBe('');
    expect(pushMessage(undefined)).toBe('');
  });
});

test.describe('what a refused publish or retire means', () => {
  test('400 keeps the API\'s sentence, its hint and one entry per table', () => {
    const refusal = refusalOf(400, {
      errormessage: "This curriculum can't be published yet. lessons: 2 rows have no name.",
      hint: 'Fix or remove the rows in the tables named, then publish again. Nothing was published.',
      fields: [
        { field: 'lessons', message: 'lessons: 2 rows have no name.' },
        { field: 'questions', message: '  ' },
        { field: 'grades', message: 'grades: 1 row has no level.' },
      ],
    });
    expect(refusal).toEqual({
      kind: 'invalid',
      message: "This curriculum can't be published yet. lessons: 2 rows have no name.",
      hint: 'Fix or remove the rows in the tables named, then publish again. Nothing was published.',
      fields: [
        { field: 'lessons', message: 'lessons: 2 rows have no name.' },
        { field: 'grades', message: 'grades: 1 row has no level.' },
      ],
    });
  });

  test('400 with no fields or words still says something', () => {
    expect(refusalOf(400, null)).toEqual({ kind: 'invalid', message: "This curriculum can't be published yet.", hint: '', fields: [] });
  });

  test('409 is the screen\'s own sentence, not the API\'s', () => {
    expect(refusalOf(409, { errormessage: 'This curriculum was published a moment ago by someone else. Reload and publish again.' })).toEqual({
      kind: 'conflict',
      message: CONFLICT_MESSAGE,
    });
    expect(CONFLICT_MESSAGE).toBe('Someone published this curriculum a moment ago. Reload to see their changes.');
  });

  test('404, 403, and the three statuses the caller words as a gateway', () => {
    expect(refusalOf(404, {})).toEqual({ kind: 'missing' });
    expect(refusalOf(403, {})).toEqual({ kind: 'forbidden', message: NO_PERMISSION_MESSAGE });
    for (const status of [0, 502, 503]) expect(refusalOf(status, {})).toEqual({ kind: 'gateway' });
  });

  test('429 and 500 are said by the screen too (the interceptor stays quiet for these calls)', () => {
    expect(refusalOf(429, {})).toEqual({ kind: 'other', message: 'Too many attempts. Wait a minute and try again.' });
    expect(refusalOf(500, { errormessage: 'Something broke.' })).toEqual({ kind: 'other', message: 'Something broke.' });
    expect(refusalOf(500, {})).toEqual({ kind: 'other', message: 'Try again in a moment.' });
  });
});
