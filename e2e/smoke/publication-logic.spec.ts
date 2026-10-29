import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  CONFLICT_MESSAGE,
  NAME_CAP,
  NO_PERMISSION_MESSAGE,
  PillSource,
  PublicationOverview,
  SUCCESS_TOAST_MS,
  SlimSummary,
  pillDate,
  pillOf,
  pushMessage,
  pushToast,
  refusalOf,
  viewOf,
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

// ---- What the publish drawer says --------------------------------------------------------------------------

const ref = (name: string, id = name) => ({ id, name });
const none = { added: [], changed: [], removed: [] };

/** A summary as central answers it, with only what a test cares about filled in. */
function summaryOf(over: {
  changes?: SlimSummary['changes'];
  lessons?: Partial<SlimSummary['affected']['lessons']>;
  questions?: Partial<SlimSummary['affected']['questions']>;
  shared?: SlimSummary['shared'];
  movedaway?: SlimSummary['movedaway'];
  movedawaymessage?: string;
}): SlimSummary {
  return {
    previous: 'p1',
    counts: {},
    changes: over.changes ?? {},
    affected: { lessons: { ...none, ...over.lessons }, questions: { ...none, ...over.questions }, truncated: false },
    shared: over.shared ?? [],
    movedaway: over.movedaway,
    movedawaymessage: over.movedawaymessage,
  };
}

function overviewOf(pending: SlimSummary | null, over: Partial<PublicationOverview> = {}): PublicationOverview {
  return {
    curriculumid: 'c1',
    publicationid: pending ? 'p1' : null,
    publicationstatus: pending ? 'published' : 'never',
    publishedat: null,
    changedsincepublish: pending !== null,
    problem: null,
    pending,
    latest: null,
    translationcoverage: null,
    ...over,
  };
}

test.describe('what the publish drawer says', () => {
  test('a curriculum never published has no diff: all of it reaches learners', () => {
    const view = viewOf(overviewOf(null));
    expect(view.mode).toBe('whole');
    expect(view.headline).toBe('This curriculum has not been published. All of it reaches learners on this publish.');
    expect(view.sections).toEqual([]);
    expect(view.publishLabel).toBe('Publish');
  });

  test('a retired curriculum says it returns, and also lists no diff', () => {
    const view = viewOf(overviewOf(null, { publicationstatus: 'withdrawn' }));
    expect(view.mode).toBe('whole');
    expect(view.headline).toBe('This curriculum is retired. All of it reaches learners again on this publish.');
    expect(view.sections).toEqual([]);
  });

  test('nothing changed: the sentence, and the button reads Re-publish', () => {
    const view = viewOf(overviewOf(summaryOf({ changes: { lessons: { added: 0, changed: 0, removed: 0 }, questions: { added: 0, changed: 0, removed: 0 } } })));
    expect(view.mode).toBe('nochange');
    expect(view.headline).toBe('Nothing has changed since the last publish.');
    expect(view.publishLabel).toBe('Re-publish');
    expect(view.sections).toEqual([]);
  });

  test('the total line counts lessons then questions, saying each noun once', () => {
    const view = viewOf(
      overviewOf(
        summaryOf({
          changes: { lessons: { added: 3, changed: 1, removed: 0 }, questions: { added: 0, changed: 0, removed: 2 } },
          lessons: { added: [ref('A'), ref('B'), ref('C')], changed: [ref('D')] },
          questions: { removed: [ref('Q1'), ref('Q2')] },
        }),
      ),
    );
    expect(view.mode).toBe('changes');
    expect(view.headline).toBe('3 lessons added, 1 changed, 2 questions removed');
    expect(view.publishLabel).toBe('Publish');
  });

  test('one of a kind is singular', () => {
    const view = viewOf(overviewOf(summaryOf({ changes: { lessons: { added: 1, changed: 0, removed: 0 } }, lessons: { added: [ref('A')] } })));
    expect(view.headline).toBe('1 lesson added');
  });

  test('changes in the other tables are counted, not named', () => {
    const view = viewOf(
      overviewOf(
        summaryOf({
          changes: { lessons: { added: 1, changed: 0, removed: 0 }, grades: { added: 1, changed: 1, removed: 0 }, lessonlearnings: { added: 3, changed: 0, removed: 0 } },
          lessons: { added: [ref('A')] },
        }),
      ),
    );
    expect(view.headline).toBe('1 lesson added, 5 other changes');
    // only lessons and questions have named lists
    expect(view.sections.map((x) => x.id)).toEqual(['lessons-added']);
  });

  test('named lists: only the kinds that happened, lessons before questions, each name once', () => {
    const view = viewOf(
      overviewOf(
        summaryOf({
          changes: { lessons: { added: 1, changed: 1, removed: 0 }, questions: { added: 2, changed: 0, removed: 1 } },
          lessons: { added: [ref('L-new')], changed: [ref('L-old')] },
          questions: { added: [ref('Q-a'), ref('Q-b')], removed: [ref('Q-gone')] },
        }),
      ),
    );
    expect(view.sections).toEqual([
      { id: 'lessons-added', title: 'Lessons added', names: ['L-new'], more: 0 },
      { id: 'lessons-changed', title: 'Lessons changed', names: ['L-old'], more: 0 },
      { id: 'questions-added', title: 'Questions added', names: ['Q-a', 'Q-b'], more: 0 },
      { id: 'questions-removed', title: 'Questions removed', names: ['Q-gone'], more: 0 },
    ]);
  });

  test('past the cap the names stop and "and N more" counts the rest from the exact count', () => {
    expect(NAME_CAP).toBe(10);
    const names = Array.from({ length: 12 }, (_, i) => ref(`Lesson ${i + 1}`));
    const view = viewOf(overviewOf(summaryOf({ changes: { lessons: { added: 12, changed: 0, removed: 0 } }, lessons: { added: names } })));
    expect(view.sections[0].names).toHaveLength(10);
    expect(view.sections[0].names[9]).toBe('Lesson 10');
    expect(view.sections[0].more).toBe(2);
    // the API names at most 200 and counts them all: 250 added, 200 named, 10 shown, 240 more
    const many = Array.from({ length: 200 }, (_, i) => ref(`Q ${i + 1}`));
    const big = viewOf(overviewOf(summaryOf({ changes: { questions: { added: 250, changed: 0, removed: 0 } }, questions: { added: many } })));
    expect(big.sections[0].names).toHaveLength(10);
    expect(big.sections[0].more).toBe(240);
    // a smaller cap
    expect(viewOf(overviewOf(summaryOf({ changes: { lessons: { added: 12, changed: 0, removed: 0 } }, lessons: { added: names } })), 3).sections[0]).toMatchObject({ more: 9 });
  });

  test('shared rows name the other curricula that also carry them', () => {
    const view = viewOf(
      overviewOf(
        summaryOf({
          changes: { questions: { added: 1, changed: 0, removed: 0 } },
          questions: { added: [ref('Shared question')] },
          shared: [
            { table: 'questions', id: 'q1', name: 'Shared question', curricula: [ref('Other A'), ref('Other B')] },
            { table: 'documents', id: 'd1', name: 'A reading', curricula: [ref('Other A')] },
          ],
        }),
      ),
    );
    expect(view.shared).toEqual([
      { name: 'Shared question', kind: 'question', alsoIn: ['Other A', 'Other B'] },
      { name: 'A reading', kind: 'document', alsoIn: ['Other A'] },
    ]);
  });

  test('the moved-away block carries the API\'s sentence and names each row and where it went', () => {
    const view = viewOf(
      overviewOf(
        summaryOf({
          changes: { lessons: { added: 0, changed: 0, removed: 1 } },
          lessons: { removed: [ref('Moved lesson')] },
          movedaway: [{ table: 'lessons', id: 'l1', name: 'Moved lesson', tocurriculum: ref('Elsewhere'), published: true }],
          movedawaymessage: '1 lesson now lives in another curriculum that does not carry it yet.',
        }),
      ),
    );
    expect(view.moved).toEqual({
      message: '1 lesson now lives in another curriculum that does not carry it yet.',
      rows: ['Lesson “Moved lesson” now lives under “Elsewhere”.'],
      more: 0,
    });
    expect(view.mode).toBe('changes');
  });

  test('no moved-away rows and no sentence: no block', () => {
    expect(viewOf(overviewOf(summaryOf({ changes: { lessons: { added: 1, changed: 0, removed: 0 } }, lessons: { added: [ref('A')] }, movedaway: [] }))).moved).toBeNull();
  });

  test('the coverage line is one clause per language, and absent while there are no translations', () => {
    expect(viewOf(overviewOf(null)).coverage).toBeNull();
    const coverage = {
      contentlanguage: 'en',
      languages: {
        km: { total: { untranslated: 2, stale: 1 }, outsidelessons: { untranslated: 0, stale: 0 }, lessons: {} },
        fr: { total: { untranslated: 0, stale: 0 }, outsidelessons: { untranslated: 0, stale: 0 }, lessons: {} },
      },
    };
    expect(viewOf(overviewOf(null, { translationcoverage: coverage })).coverage).toBe('Translations: fr: translated; km: 2 untranslated, 1 stale');
  });

  test('the API\'s problem sentence is passed on, trimmed; none when empty', () => {
    expect(viewOf(overviewOf(null, { problem: '  lessons: 1 row hangs from nowhere.  ' })).problem).toBe('lessons: 1 row hangs from nowhere.');
    expect(viewOf(overviewOf(null, { problem: '' })).problem).toBeNull();
  });
});

// ---- Sync Content on the curriculum list ---------------------------------------------------------------------

/**
 * The list's template is read as text: the permission check is a directive on an element, and the two role ids it used to
 * name (`zr5ER4QD`, `Mapyr2Pw`) matched nothing, because the admin's permissions are the token's permission names. A test in
 * a browser cannot tell a dead entry from an absent one, so the array itself is pinned.
 */
const LIST_TEMPLATE = join(__dirname, '../../src/app/modules/curriculum/curriculum-index/curriculum-index.component.html');

test.describe('Sync Content on the curriculum list', () => {
  const wrapper = (): string => {
    const html = readFileSync(LIST_TEMPLATE, 'utf8');
    const found = html.match(/<span\b[^>]*data-testid="sync-content-wrap"[^>]*>/);
    expect(found, 'the Sync Content wrapper is in the template').not.toBeNull();
    return (found as RegExpMatchArray)[0];
  };

  test('is offered to superadmin and sync_content only: no role ids in the permission array', () => {
    const array = wrapper().match(/\*ngxPermissionsOnly="\[([^\]]*)\]"/);
    expect(array, 'the wrapper carries the permission check').not.toBeNull();
    const names = (array as RegExpMatchArray)[1].split(',').map((n) => n.trim().replace(/^'|'$/g, ''));
    expect(names).toEqual(['superadmin', 'sync_content']);
  });

  test('says what it does: it re-pushes the published set to the learner server', () => {
    expect(wrapper()).toContain('nzTooltipTitle="Re-push the published set to the learner server"');
  });
});
