/**
 * Translations of content text (bilingual content, workspace docs/bilingual-content-design.md).
 *
 * The central API (edtech-lms-api, `src/constants/content-translations.ts` and `src/business/content-translations.ts`)
 * owns the rules; this file is the admin's reading of them: which texts a row has, which of them can be translated,
 * what to send, and how a refusal is worded. It has no Angular in it, so the Playwright logic specs run it in Node
 * (e2e/smoke/translations-logic.spec.ts).
 *
 * The lists below are a copy of the contract's, kept to what the panel needs. They are checked against the real API by
 * e2e/smoke/translations-panel.spec.ts, which saves a translation of every offered text and expects each to be accepted.
 */

/** The tables whose rows have translations, and for each the fields (display text only). */
export const TRANSLATABLE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  curriculums: ['curriculumname', 'curriculumdescription'],
  grades: ['gradename', 'gradedescription'],
  levels: ['levelname', 'leveldescription'],
  lessons: ['lessonname', 'lessondescription'],
  lessonlearnings: ['lessonlearningname', 'lessonlearningdescription'],
  lessonpractices: ['lessonpracticename', 'lessonpracticedescription'],
  lessonquizzes: ['lessonquizname', 'lessonquizdescription'],
  lessonplans: ['lessonplanname', 'lessonplandescription'],
  questions: ['questiontext', 'headingtext', 'questionoptiontext', 'questionassociatetext', 'questiondistractortext', 'feedback'],
};

/** The subkeys of `feedback`: the keys of `questions.questionfeedback`. */
export const FEEDBACK_KEYS: readonly string[] = ['correctmessage', 'incorrectmessage'];

/**
 * The fields of a question that an answer is graded by, per template id: never translated (decision 8). Template 21
 * compares the learner's typed answer with the option text; 8, 21 and 23 split `questiontext` on the blank markers.
 */
export const ANSWER_BEARING_FIELDS: Readonly<Record<number, readonly string[]>> = {
  8: ['questiontext'],
  21: ['questiontext', 'questionoptiontext'],
  23: ['questiontext'],
};

/** A language code: 2 to 8 letters, digits and hyphens (`km`, `en`, `pt-BR`). */
export const LANGUAGE_CODE = /^[A-Za-z0-9-]{2,8}$/;

/** The longest subkey the API stores (an option id of the seed is 42 characters). */
export const SUBKEY_MAX_LENGTH = 64;

/** The most bytes of one translated text (the column is TEXT). */
export const TRANSLATION_TEXT_MAX_BYTES = 65535;

/** A language code as the API stores it: its primary subtag in lower case (`KM` is `km`, `PT-BR` is `pt-BR`). */
export function normaliseLanguage(code: string): string {
  const dash = code.indexOf('-');
  return dash === -1 ? code.toLowerCase() : code.slice(0, dash).toLowerCase() + code.slice(dash);
}

export function isAnswerBearing(templatetypeid: unknown, field: string): boolean {
  const template =
    typeof templatetypeid === 'string' && templatetypeid.trim() !== '' ? Number(templatetypeid) : templatetypeid;
  return typeof template === 'number' && (ANSWER_BEARING_FIELDS[template] ?? []).includes(field);
}

// ---- What the API returns -----------------------------------------------------------------

/** One saved translation (GET and PUT /translations/:tablename/:rowid). */
export interface TranslationView {
  translationid: string;
  tablename: string;
  rowid: string;
  field: string;
  subkey: string;
  language: string;
  text: string;
  sourcehash: string;
  lastupdated: string;
  /** The row's text is no longer the text this was translated from. */
  stale: boolean;
}

export interface TranslationList {
  tablename: string;
  rowid: string;
  /** The organisation's base language; null while it has none. */
  contentlanguage: string | null;
  translations: TranslationView[];
}

export interface CoverageCounts {
  untranslated: number;
  stale: number;
}

export interface LanguageCoverage {
  total: CoverageCounts;
  outsidelessons: CoverageCounts;
  lessons: Record<string, CoverageCounts>;
}

export interface TranslationCoverage {
  contentlanguage: string | null;
  languages: Record<string, LanguageCoverage>;
}

// ---- The texts of a row --------------------------------------------------------------------

/** One text of a row that can be shown in the panel. */
export interface TextItem {
  /** `<field>` or `<field>.<subkey>`: the key of the PUT body. */
  key: string;
  field: string;
  subkey: string;
  /** What the editor calls it ("Lesson name", "Option 2", "Correct feedback"). */
  label: string;
  /** The text in the base language, as the row holds it now. */
  base: string;
  /** The text an answer is graded by: shown, never translated. */
  answerBearing: boolean;
}

const FIELD_LABELS: Readonly<Record<string, string>> = {
  curriculumname: 'Name',
  curriculumdescription: 'Description',
  gradename: 'Name',
  gradedescription: 'Description',
  levelname: 'Name',
  leveldescription: 'Description',
  lessonname: 'Name',
  lessondescription: 'Description',
  lessonlearningname: 'Name',
  lessonlearningdescription: 'Description',
  lessonpracticename: 'Name',
  lessonpracticedescription: 'Description',
  lessonquizname: 'Name',
  lessonquizdescription: 'Description',
  lessonplanname: 'Name',
  lessonplandescription: 'Description',
  questiontext: 'Question',
  headingtext: 'Heading',
};

const FEEDBACK_LABELS: Readonly<Record<string, string>> = {
  correctmessage: 'Correct feedback',
  incorrectmessage: 'Incorrect feedback',
};

export function keyOf(field: string, subkey: string): string {
  return subkey === '' ? field : `${field}.${subkey}`;
}

/** `<field>.<subkey>` -> the two parts. The subkey is everything after the first dot (an option id has none). */
export function splitKey(key: string): { field: string; subkey: string } {
  const dot = key.indexOf('.');
  return dot === -1 ? { field: key, subkey: '' } : { field: key.slice(0, dot), subkey: key.slice(dot + 1) };
}

type Row = Record<string, unknown>;

function asValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function entries(value: unknown): Row[] {
  const list = asValue(value);
  return Array.isArray(list) ? list.filter((e): e is Row => typeof e === 'object' && e !== null) : [];
}

/** The texts of a row, in reading order. A text the row does not have (empty or missing) is left out: there is nothing to translate. */
export function textsOf(tablename: string, row: Row | null | undefined): TextItem[] {
  if (!row || !Object.prototype.hasOwnProperty.call(TRANSLATABLE_FIELDS, tablename)) return [];
  const out: TextItem[] = [];
  const add = (field: string, subkey: string, label: string, base: unknown, answerBearing = false) => {
    if (typeof base !== 'string' || base.trim() === '') return;
    out.push({ key: keyOf(field, subkey), field, subkey, label, base, answerBearing });
  };

  if (tablename !== 'questions') {
    for (const field of TRANSLATABLE_FIELDS[tablename]) add(field, '', FIELD_LABELS[field] ?? field, row[field]);
    return out;
  }

  const template = row['templatetypeid'];
  const graded = (field: string) => isAnswerBearing(template, field);
  add('questiontext', '', FIELD_LABELS['questiontext'], row['questiontext'], graded('questiontext'));
  const heading = asValue(row['questionheading']) as Row | null | undefined;
  add('headingtext', '', FIELD_LABELS['headingtext'], heading?.['headingtext']);

  entries(row['questionoptions']).forEach((option, index) => {
    const id = option['questionoptionid'];
    if (typeof id !== 'string' || id === '') return;
    add('questionoptiontext', id, `Option ${index + 1}`, option['questionoptiontext'], graded('questionoptiontext'));
    const partner = asValue(option['questionassociate']) as Row | null | undefined;
    add('questionassociatetext', id, `Option ${index + 1}, matching text`, partner?.['questionassociatetext']);
  });
  entries(row['questiondistractors']).forEach((distractor, index) => {
    const id = distractor['questiondistractorid'];
    if (typeof id === 'string' && id !== '') add('questiondistractortext', id, `Distractor ${index + 1}`, distractor['questiondistractortext']);
  });
  const feedback = asValue(row['questionfeedback']) as Row | null | undefined;
  for (const key of FEEDBACK_KEYS) add('feedback', key, FEEDBACK_LABELS[key], feedback?.[key]);
  return out;
}

// ---- Languages ------------------------------------------------------------------------------

/** The languages that already hold a translation of the row, in code order. */
export function languagesOf(translations: readonly TranslationView[]): string[] {
  return [...new Set(translations.map((t) => t.language))].sort();
}

/** Checks a typed language code. Returns the code as the API will store it, or why it can't be used. */
export function checkLanguageCode(
  typed: string,
  contentlanguage: string | null,
  existing: readonly string[],
): { code: string; error: null } | { code: null; error: string } {
  const value = typed.trim();
  if (value === '') return { code: null, error: 'Enter a language code, such as km.' };
  if (!LANGUAGE_CODE.test(value)) return { code: null, error: 'Use 2 to 8 letters, digits or hyphens, such as km or pt-BR.' };
  const code = normaliseLanguage(value);
  if (contentlanguage !== null && code.toLowerCase() === contentlanguage.toLowerCase()) {
    return { code: null, error: "That is this organisation's own content language. Its text is the row's own text." };
  }
  if (existing.some((l) => l.toLowerCase() === code.toLowerCase())) {
    return { code: null, error: 'That language is already listed.' };
  }
  return { code, error: null };
}

/** "Khmer (km)" where the browser knows the language, else the code. */
export function languageLabel(code: string): string {
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(code);
    return name && name.toLowerCase() !== code.toLowerCase() ? `${name} (${code})` : code;
  } catch {
    return code;
  }
}

// ---- Drafts and what to save ----------------------------------------------------------------

/** What is saved for one language, by text key. */
export function savedByKey(translations: readonly TranslationView[], language: string): Map<string, TranslationView> {
  const out = new Map<string, TranslationView>();
  for (const t of translations) {
    if (t.language.toLowerCase() === language.toLowerCase()) out.set(keyOf(t.field, t.subkey), t);
  }
  return out;
}

/** The draft of a language when it is opened: each text's saved translation, else empty. Answer-bearing texts have none. */
export function initialDraft(items: readonly TextItem[], saved: ReadonlyMap<string, TranslationView>): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const item of items) {
    if (!item.answerBearing) draft[item.key] = saved.get(item.key)?.text ?? '';
  }
  return draft;
}

export interface Changes {
  /** The PUT body's `fields`: every text typed or re-confirmed. */
  fields: Record<string, string>;
  /** Texts that had a saved translation and were emptied: the API can't remove one text (only a whole language), so these block the save. */
  blanked: string[];
  /** A text over the API's limit. */
  tooLong: string[];
}

/**
 * What a save of one language sends. Only a text that was changed, or one the editor confirmed as still right
 * (`confirmed`, for a stale translation whose wording is fine), is sent: the API records the hash of the base
 * text AS IT IS NOW with each text it saves, so sending an untouched stale translation would quietly mark it current.
 */
export function changesFor(
  items: readonly TextItem[],
  saved: ReadonlyMap<string, TranslationView>,
  draft: Readonly<Record<string, string>>,
  confirmed: ReadonlySet<string>,
): Changes {
  const out: Changes = { fields: {}, blanked: [], tooLong: [] };
  for (const item of items) {
    if (item.answerBearing) continue;
    const typed = draft[item.key] ?? '';
    const before = saved.get(item.key)?.text;
    if (typed.trim() === '') {
      if (before !== undefined && before !== '') out.blanked.push(item.key);
      continue;
    }
    if (typed === before && !confirmed.has(item.key)) continue;
    if (new TextEncoder().encode(typed).length > TRANSLATION_TEXT_MAX_BYTES) {
      out.tooLong.push(item.key);
      continue;
    }
    out.fields[item.key] = typed;
  }
  return out;
}

/** Can this language be saved: something to send, and nothing that blocks it. */
export function canSave(changes: Changes): boolean {
  return Object.keys(changes.fields).length > 0 && changes.blanked.length === 0 && changes.tooLong.length === 0;
}

/** Texts of the row that are not yet translated into the language (not counting graded ones). */
export function untranslatedKeys(items: readonly TextItem[], saved: ReadonlyMap<string, TranslationView>): string[] {
  return items.filter((i) => !i.answerBearing && !saved.has(i.key)).map((i) => i.key);
}

// ---- Errors ---------------------------------------------------------------------------------

export const TRANSLATIONS_TOAST_KEY = 'translations-error';

interface ApiErrorBody {
  errormessage?: unknown;
  fields?: unknown;
}

const word = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * The words for a failed translations call: the catalogue's own sentences for a 400 (what is wrong with which text), else a
 * plain line. Used for the toast, so the person is not left with a button that did nothing.
 */
export function translationErrorMessage(status: number, body: unknown): string {
  const b = (typeof body === 'object' && body !== null ? body : {}) as ApiErrorBody;
  if (status === 400) {
    const fields = Array.isArray(b.fields) ? b.fields : [];
    const lines = fields
      .map((f) => (typeof f === 'object' && f !== null ? word((f as { message?: unknown }).message) : ''))
      .filter((m) => m !== '');
    if (lines.length > 0) return [...new Set(lines)].join(' ');
    return word(b.errormessage) || "Some of the information isn't valid.";
  }
  if (status === 403) return "You don't have permission to change the translations of this.";
  if (status === 404) return 'That record no longer exists, so it has no translations.';
  if (status === 502 || status === 503) {
    return word(b.errormessage) || 'The service is temporarily unavailable. Try again in a few minutes.';
  }
  if (status === 0) return "The translations couldn't be reached. Check the connection and try again.";
  return word(b.errormessage) || "The translations couldn't be saved. Try again.";
}

// ---- Counts on the tree ---------------------------------------------------------------------

export interface CoverageChip {
  language: string;
  untranslated: number;
  stale: number;
  /** "km: 2 untranslated, 1 stale" or "km: translated". */
  text: string;
  tone: 'done' | 'stale' | 'open';
}

function describe(language: string, c: CoverageCounts): CoverageChip {
  const parts: string[] = [];
  if (c.untranslated > 0) parts.push(`${c.untranslated} untranslated`);
  if (c.stale > 0) parts.push(`${c.stale} stale`);
  return {
    language,
    untranslated: c.untranslated,
    stale: c.stale,
    text: `${language}: ${parts.length > 0 ? parts.join(', ') : 'translated'}`,
    tone: c.untranslated > 0 ? 'open' : c.stale > 0 ? 'stale' : 'done',
  };
}

/** One chip per language for a lesson. None while the organisation has no translations in any language. */
export function lessonChips(coverage: TranslationCoverage | null | undefined, lessonid: string): CoverageChip[] {
  if (!coverage) return [];
  return Object.keys(coverage.languages)
    .sort()
    .map((language) => describe(language, coverage.languages[language].lessons[lessonid] ?? { untranslated: 0, stale: 0 }));
}

/** One chip per language for the whole curriculum. */
export function curriculumChips(coverage: TranslationCoverage | null | undefined): CoverageChip[] {
  if (!coverage) return [];
  return Object.keys(coverage.languages)
    .sort()
    .map((language) => describe(language, coverage.languages[language].total));
}
