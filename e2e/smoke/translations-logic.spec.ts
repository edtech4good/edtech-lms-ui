import { expect, test } from '@playwright/test';
import {
  TranslationView,
  canSave,
  changesFor,
  checkLanguageCode,
  curriculumChips,
  initialDraft,
  languagesOf,
  lessonChips,
  savedByKey,
  textsOf,
  translationErrorMessage,
  untranslatedKeys,
} from '../../src/app/shared/translations/translations.model';
import {
  OTHER_LANGUAGE,
  contentLanguageChoice,
  contentLanguageError,
  contentLanguageValue,
} from '../../src/app/modules/organisation/organisation-content-language';

/**
 * The Translations panel's rules (src/app/shared/translations/translations.model.ts) and the organisation's content
 * language field (organisation-form.ts), in Node. No browser, no API: which texts a row offers, which are graded and so
 * not translatable, what a save sends, how a refusal is worded, what the tree's chips say. The live behaviour against the
 * central API is in translations-panel.spec.ts.
 *
 * The text in these fixtures is opaque (Latin letters, ids): the rules do not depend on the script, and no Khmer is written here.
 */

const row = (over: Record<string, unknown> = {}) => ({ lessonname: 'Counting', lessondescription: 'Count to ten', ...over });

const question = (over: Record<string, unknown> = {}) => ({
  questionid: 'q1',
  templatetypeid: 1,
  questiontext: 'Which is larger?',
  questionheading: { headingtext: 'Heading', headingfile: null },
  questionoptions: [
    { questionoptionid: 'q1-opt-1', questionoptiontext: 'Seven', questionassociate: null },
    { questionoptionid: 'q1-opt-2', questionoptiontext: 'Twelve', questionassociate: { questionoptionid: 'q1-opt-2', questionassociatetext: 'Partner' } },
  ],
  questiondistractors: [{ questiondistractorid: 'q1-d-1', questiondistractortext: 'Distractor text' }],
  questionfeedback: { correctmessage: 'Well done', incorrectmessage: null },
  ...over,
});

const saved = (field: string, subkey: string, text: string, stale = false, language = 'xx'): TranslationView => ({
  translationid: `${field}-${subkey}-${language}`,
  tablename: 'lessons',
  rowid: 'r',
  field,
  subkey,
  language,
  text,
  sourcehash: 'h',
  lastupdated: '2026-10-28T00:00:00.000Z',
  stale,
});

test.describe('the texts a row offers', () => {
  test('a lesson offers its name and description, in that order', () => {
    expect(textsOf('lessons', row()).map((t) => [t.key, t.label, t.base, t.answerBearing])).toEqual([
      ['lessonname', 'Name', 'Counting', false],
      ['lessondescription', 'Description', 'Count to ten', false],
    ]);
  });
  test('a text the row does not have (null, empty, blank) is not offered: there is nothing to translate', () => {
    expect(textsOf('lessons', row({ lessondescription: null })).map((t) => t.key)).toEqual(['lessonname']);
    expect(textsOf('lessons', row({ lessondescription: '   ' })).map((t) => t.key)).toEqual(['lessonname']);
  });
  test('a table that cannot be translated, or no row, offers nothing', () => {
    expect(textsOf('students', row())).toEqual([]);
    expect(textsOf('lessons', null)).toEqual([]);
  });
  test('every table of the contract uses its own field names', () => {
    expect(textsOf('curriculums', { curriculumname: 'A', curriculumdescription: 'B' }).map((t) => t.key)).toEqual(['curriculumname', 'curriculumdescription']);
    expect(textsOf('grades', { gradename: 'A' }).map((t) => t.key)).toEqual(['gradename']);
    expect(textsOf('levels', { leveldescription: 'B' }).map((t) => t.key)).toEqual(['leveldescription']);
  });
  test('a question offers its text, heading, options, partners, distractors and the messages it has, keyed by id', () => {
    expect(textsOf('questions', question()).map((t) => [t.key, t.label])).toEqual([
      ['questiontext', 'Question'],
      ['headingtext', 'Heading'],
      ['questionoptiontext.q1-opt-1', 'Option 1'],
      ['questionoptiontext.q1-opt-2', 'Option 2'],
      ['questionassociatetext.q1-opt-2', 'Option 2, matching text'],
      ['questiondistractortext.q1-d-1', 'Distractor 1'],
      ['feedback.correctmessage', 'Correct feedback'],
    ]);
  });
  test('JSON that arrives as a string is read the same', () => {
    const asString = question({
      questionoptions: JSON.stringify(question().questionoptions),
      questionheading: JSON.stringify(question().questionheading),
      questionfeedback: JSON.stringify(question().questionfeedback),
    });
    expect(textsOf('questions', asString).map((t) => t.key)).toEqual(textsOf('questions', question()).map((t) => t.key));
  });
  test('an option without an id is not offered: a translation is keyed by it', () => {
    const r = question({ questionoptions: [{ questionoptiontext: 'No id' }] });
    expect(textsOf('questions', r).some((t) => t.field === 'questionoptiontext')).toBe(false);
  });
});

test.describe('texts an answer is graded by are shown and never translated', () => {
  test('template 21: the question text and the option text', () => {
    const graded = textsOf('questions', question({ templatetypeid: 21 })).filter((t) => t.answerBearing).map((t) => t.key);
    expect(graded).toEqual(['questiontext', 'questionoptiontext.q1-opt-1', 'questionoptiontext.q1-opt-2']);
  });
  test('templates 8 and 23: only the question text; their option text is display text', () => {
    for (const template of [8, 23]) {
      const items = textsOf('questions', question({ templatetypeid: template }));
      expect(items.filter((t) => t.answerBearing).map((t) => t.key)).toEqual(['questiontext']);
      expect(items.find((t) => t.key === 'questionoptiontext.q1-opt-1')?.answerBearing).toBe(false);
    }
  });
  test('the template may arrive as a string; any other template grades nothing by text', () => {
    expect(textsOf('questions', question({ templatetypeid: '21' })).some((t) => t.answerBearing)).toBe(true);
    expect(textsOf('questions', question({ templatetypeid: 5 })).some((t) => t.answerBearing)).toBe(false);
  });
  test('a graded text gets no draft and is never in a save', () => {
    const items = textsOf('questions', question({ templatetypeid: 21 }));
    expect(Object.keys(initialDraft(items, new Map()))).not.toContain('questiontext');
    const draft = { ...initialDraft(items, new Map()), headingtext: 'H' };
    expect(changesFor(items, new Map(), draft, new Set()).fields).toEqual({ headingtext: 'H' });
  });
});

test.describe('what a save sends', () => {
  const items = textsOf('lessons', row());
  const list = [saved('lessonname', '', 'Old name', true), saved('lessondescription', '', 'Old description')];
  const map = savedByKey(list, 'xx');

  test('the draft starts as what is saved, and empty where nothing is', () => {
    expect(initialDraft(items, map)).toEqual({ lessonname: 'Old name', lessondescription: 'Old description' });
    expect(initialDraft(items, new Map())).toEqual({ lessonname: '', lessondescription: '' });
  });
  test('untouched texts are not sent: an old translation is not quietly marked current', () => {
    const c = changesFor(items, map, initialDraft(items, map), new Set());
    expect(c.fields).toEqual({});
    expect(canSave(c)).toBe(false);
  });
  test('an edited text is sent; so is a stale one confirmed as still right', () => {
    const edited = changesFor(items, map, { lessonname: 'Old name', lessondescription: 'New' }, new Set());
    expect(edited.fields).toEqual({ lessondescription: 'New' });
    const confirmed = changesFor(items, map, initialDraft(items, map), new Set(['lessonname']));
    expect(confirmed.fields).toEqual({ lessonname: 'Old name' });
    expect(canSave(confirmed)).toBe(true);
  });
  test('a first translation is sent; a blank text is not', () => {
    const c = changesFor(items, new Map(), { lessonname: 'N', lessondescription: '  ' }, new Set());
    expect(c.fields).toEqual({ lessonname: 'N' });
    expect(c.blanked).toEqual([]);
  });
  test('emptying a saved translation blocks the save: the API can remove a language, not one text', () => {
    const c = changesFor(items, map, { lessonname: '', lessondescription: 'Old description' }, new Set());
    expect(c.blanked).toEqual(['lessonname']);
    expect(canSave(c)).toBe(false);
  });
  test('a text over the API\'s 65,535 bytes blocks the save: the limit counts bytes, not characters', () => {
    // A three-byte character (the euro sign): 21,846 of them is 65,538 bytes but only 21,846 characters.
    const wide = '\u20AC'.repeat(21846);
    expect(wide.length).toBeLessThan(65535);
    const c = changesFor(items, new Map(), { lessonname: wide, lessondescription: '' }, new Set());
    expect(c.tooLong).toEqual(['lessonname']);
    expect(canSave(c)).toBe(false);
  });
  test('the keys of a saved question translation are <field>.<subkey>', () => {
    const q = textsOf('questions', question());
    const draft = { ...initialDraft(q, new Map()), 'questionoptiontext.q1-opt-2': 'T', 'feedback.correctmessage': 'F' };
    expect(changesFor(q, new Map(), draft, new Set()).fields).toEqual({ 'questionoptiontext.q1-opt-2': 'T', 'feedback.correctmessage': 'F' });
  });
  test('untranslated keys leave out graded texts and saved ones', () => {
    const q = textsOf('questions', question({ templatetypeid: 21 }));
    const have = savedByKey([saved('headingtext', '', 'H')], 'xx');
    expect(untranslatedKeys(q, have)).toEqual(['questionassociatetext.q1-opt-2', 'questiondistractortext.q1-d-1', 'feedback.correctmessage']);
  });
});

test.describe('languages', () => {
  test('the languages of a row are those it holds, once each, in code order', () => {
    expect(languagesOf([saved('a', '', 't', false, 'th'), saved('b', '', 't', false, 'km'), saved('c', '', 't', false, 'km')])).toEqual(['km', 'th']);
  });
  test('a typed code is checked as the API does, and stored in its normal form', () => {
    expect(checkLanguageCode(' KM ', 'en', [])).toEqual({ code: 'km', error: null });
    expect(checkLanguageCode('PT-BR', 'en', [])).toEqual({ code: 'pt-BR', error: null });
  });
  test('refused: blank, the wrong shape, the organisation\'s own language (any case), one already listed', () => {
    expect(checkLanguageCode('', 'en', []).error).toMatch(/Enter a language code/);
    expect(checkLanguageCode('k', 'en', []).error).toMatch(/2 to 8/);
    expect(checkLanguageCode('khmer language', 'en', []).error).toMatch(/2 to 8/);
    expect(checkLanguageCode('EN', 'en', []).error).toMatch(/own content language/);
    expect(checkLanguageCode('km', 'en', ['km']).error).toMatch(/already listed/);
  });
});

test.describe('how a refusal is worded', () => {
  test('a 400 is the catalogue\'s own sentences, once each', () => {
    const body = { errormessage: "Some of the information isn't valid.", fields: [{ field: 'language', message: 'Set the organisation\'s content language first.' }, { field: 'x', message: 'Set the organisation\'s content language first.' }] };
    expect(translationErrorMessage(400, body)).toBe("Set the organisation's content language first.");
  });
  test('a 400 with no field sentences falls back to its message, then to a plain line', () => {
    expect(translationErrorMessage(400, { errormessage: 'Nope.' })).toBe('Nope.');
    expect(translationErrorMessage(400, null)).toBe("Some of the information isn't valid.");
  });
  test('403, 404, 502, no connection and anything else each say something different and plain', () => {
    const said = [403, 404, 502, 0, 500].map((s) => translationErrorMessage(s, null));
    expect(new Set(said).size).toBe(5);
    expect(translationErrorMessage(502, { errormessage: 'Student server refused it.' })).toBe('Student server refused it.');
  });
});

test.describe('counts on the tree', () => {
  const coverage = {
    contentlanguage: 'en',
    languages: {
      th: { total: { untranslated: 0, stale: 0 }, outsidelessons: { untranslated: 0, stale: 0 }, lessons: { l1: { untranslated: 0, stale: 0 } } },
      km: {
        total: { untranslated: 3, stale: 1 },
        outsidelessons: { untranslated: 0, stale: 0 },
        lessons: { l1: { untranslated: 2, stale: 1 }, l2: { untranslated: 0, stale: 2 }, l3: { untranslated: 1, stale: 0 } },
      },
    },
  };
  test('one chip per language, in code order, with the lesson\'s own counts', () => {
    expect(lessonChips(coverage, 'l1').map((c) => [c.language, c.text, c.tone])).toEqual([
      ['km', 'km: 2 untranslated, 1 stale', 'open'],
      ['th', 'th: translated', 'done'],
    ]);
  });
  test('stale only is its own tone; untranslated wins over stale', () => {
    expect(lessonChips(coverage, 'l2')[0]).toMatchObject({ text: 'km: 2 stale', tone: 'stale' });
    expect(lessonChips(coverage, 'l3')[0]).toMatchObject({ text: 'km: 1 untranslated', tone: 'open' });
  });
  test('a lesson the coverage does not name counts as translated, not as an error', () => {
    expect(lessonChips(coverage, 'nope')[0].text).toBe('km: translated');
  });
  test('no coverage, or an organisation with no translations, has no chips', () => {
    expect(lessonChips(null, 'l1')).toEqual([]);
    expect(lessonChips({ contentlanguage: null, languages: {} }, 'l1')).toEqual([]);
    expect(curriculumChips(undefined)).toEqual([]);
  });
  test('the curriculum chip is the language\'s total', () => {
    expect(curriculumChips(coverage)[0].text).toBe('km: 3 untranslated, 1 stale');
  });
});

test.describe('the organisation\'s content language field', () => {
  test('a stored code from the list is that choice; another code is "another language" with the code typed; none is empty', () => {
    expect(contentLanguageChoice('km')).toEqual({ choice: 'km', other: '' });
    expect(contentLanguageChoice('pt-BR')).toEqual({ choice: OTHER_LANGUAGE, other: 'pt-BR' });
    expect(contentLanguageChoice(null)).toEqual({ choice: '', other: '' });
    expect(contentLanguageChoice(undefined)).toEqual({ choice: '', other: '' });
  });
  test('what is sent: the code, normalised, or null to clear', () => {
    expect(contentLanguageValue('km', '')).toBe('km');
    expect(contentLanguageValue('', '')).toBeNull();
    expect(contentLanguageValue(OTHER_LANGUAGE, ' PT-BR ')).toBe('pt-BR');
    expect(contentLanguageValue(OTHER_LANGUAGE, '')).toBeNull();
  });
  test('a typed code is checked; a listed one needs no check', () => {
    expect(contentLanguageError('km', '')).toBeNull();
    expect(contentLanguageError(OTHER_LANGUAGE, '')).toMatch(/Enter a language code/);
    expect(contentLanguageError(OTHER_LANGUAGE, 'x')).toMatch(/2 to 8/);
    expect(contentLanguageError(OTHER_LANGUAGE, 'pt-BR')).toBeNull();
  });
});
