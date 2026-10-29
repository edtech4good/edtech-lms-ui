import { format } from 'date-fns';
import { curriculumChips } from 'src/app/shared/translations/translations.model';
import type { TranslationCoverage } from 'src/app/shared/translations/translations.model';

/**
 * A curriculum's publication state, as the admin shows it (design: docs/content-publishing-design.md; plan:
 * docs/admin-publish-screen-plan.md). Pure rules, no Angular: the pill a list row or a tree node shows, and (in the
 * rest of this file) the words of the publish drawer. Tested in Node by e2e/smoke/publication-logic.spec.ts.
 *
 * The API says `withdrawn`; the screen says "Retired" (the route and the note are called retire).
 */

export type PublicationStatus = 'never' | 'published' | 'withdrawn';

/** What `GET /curriculum/publication/:id` answers that the pill needs. */
export interface PillSource {
  publicationstatus: PublicationStatus;
  publishedat?: string | null;
  /** True when the live rows differ from the latest publication. Absent on the map (the tree does not carry it). */
  changedsincepublish?: boolean;
  /** Null when the live rows can be published; else what stops them. */
  problem?: string | null;
}

export type PillKind = 'never' | 'published' | 'changed' | 'retired' | 'problem';

export interface Pill {
  kind: PillKind;
  text: string;
  /** The hover text: the API's own words for a problem, else null. */
  title: string | null;
}

/** The date a pill shows: "29 Oct 2026" (the browser's own day). Empty when the date is missing or not a date. */
export function pillDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : format(date, 'd MMM yyyy');
}

/**
 * The one pill a curriculum shows. A `problem` comes first (the rows cannot be published as they are), then the three
 * states of the design, with "Changed since publish" only for a curriculum that is published.
 */
export function pillOf(source: PillSource): Pill {
  const problem = typeof source.problem === 'string' && source.problem.trim() !== '' ? source.problem.trim() : null;
  if (problem !== null) return { kind: 'problem', text: "Can't be published", title: problem };
  if (source.publicationstatus === 'withdrawn') return { kind: 'retired', text: 'Retired', title: null };
  if (source.publicationstatus === 'published') {
    if (source.changedsincepublish === true) return { kind: 'changed', text: 'Changed since publish', title: null };
    const day = pillDate(source.publishedat);
    return { kind: 'published', text: day ? `Published ${day}` : 'Published', title: null };
  }
  return { kind: 'never', text: 'Never published', title: null };
}

// ---- What the API answers (central: src/business/curriculum-publication.ts) -----------------------------

export interface RowRef {
  id: string;
  name: string;
}
export interface TableChange {
  added: number;
  removed: number;
  changed: number;
}
export interface Affected {
  added: RowRef[];
  removed: RowRef[];
  changed: RowRef[];
}
export interface SharedRow {
  table: 'questions' | 'documents';
  id: string;
  name: string;
  /** The organisation's other curricula that also use the row. */
  curricula: RowRef[];
}
export interface MovedAway {
  table: 'grades' | 'levels' | 'lessons';
  id: string;
  name: string;
  /** The curriculum the row lives under now. */
  tocurriculum: RowRef;
  published: boolean;
}

/** A publication's summary, as central answers it (`SlimSummary`). */
export interface SlimSummary {
  previous: string | null;
  counts: Record<string, number>;
  /** Exact, per table. */
  changes: Record<string, TableChange>;
  /** Lessons and questions by name; at most 200 of each kind are named, the counts above are exact. */
  affected: { lessons: Affected; questions: Affected; truncated: boolean };
  shared: SharedRow[];
  movedaway?: MovedAway[];
  /** Only when `movedaway` is not empty: the sentence an editor reads. */
  movedawaymessage?: string;
}

export interface PublicationOverview extends PillSource {
  curriculumid: string;
  publicationid: string | null;
  changedsincepublish: boolean;
  problem: string | null;
  /** What a publish now would record; null when the latest publication is not `published` (never, retired). */
  pending: SlimSummary | null;
  latest: { publicationid: string; publishedat: string; status: PublicationStatus; summary: SlimSummary } | null;
  translationcoverage: TranslationCoverage | null;
}

/** Where a push to the learner server stands after an act (central: `publish-push.ts`). */
export interface PublishAnswer {
  publicationid: string;
  publishedat: string;
  summary: SlimSummary;
  push?: PushOutcome;
}

export interface RetireAnswer {
  curriculumid: string;
  retired: boolean;
  publicationstatus: PublicationStatus;
  push?: PushOutcome;
}

/** How a push to the learner server went (central: `push` of the publish, retire and delete answers). */
export interface PushOutcome {
  status: 'pushed' | 'failed' | 'skipped';
  message: string;
}

/** The toast an act's `push` makes: a failed push is an error that stays (duration 0), anything else a success that goes. */
export interface PushToast {
  type: 'success' | 'error';
  /** Milliseconds; 0 stays until it is closed. */
  duration: number;
}

export const SUCCESS_TOAST_MS = 6000;

export function pushToast(push: PushOutcome | null | undefined): PushToast {
  return push?.status === 'failed' ? { type: 'error', duration: 0 } : { type: 'success', duration: SUCCESS_TOAST_MS };
}

/** The sentence a toast carries for the act's push: the API's `message`, or '' when the answer had no push. */
export function pushMessage(push: PushOutcome | null | undefined): string {
  return typeof push?.message === 'string' ? push.message.trim() : '';
}

// ---- Refusals, said by the screen ----------------------------------------------------------------------

/** What a 409 on publish says: someone else published the curriculum between this person's read and publish. */
export const CONFLICT_MESSAGE = 'Someone published this curriculum a moment ago. Reload to see their changes.';

/** What a 403 says (the interceptor's own line; a call that says its failures itself needs it again). */
export const NO_PERMISSION_MESSAGE = "You don't have permission to do that.";

/** What a call that could not be answered says (status 0). */
export const UNREACHABLE_MESSAGE = "The service couldn't be reached. Check the connection and try again.";

const FALLBACK_MESSAGE = 'Try again in a moment.';

/** One table the API names in a 400 for a curriculum that cannot be published, with what is wrong in it. */
export interface FieldProblem {
  field: string;
  message: string;
}

export type Refusal =
  | { kind: 'invalid'; message: string; hint: string; fields: FieldProblem[] }
  | { kind: 'conflict'; message: string }
  | { kind: 'missing' }
  | { kind: 'forbidden'; message: string }
  /** Status 0, 502 or 503: the caller words it (the API's own sentence for a 502/503, `gatewayText`). */
  | { kind: 'gateway' }
  | { kind: 'other'; message: string };

const word = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * What a failed publish or retire means, from its status and body. Used because both calls are made with
 * FAILURES_SHOWN_BY_CALLER: the error interceptor shows nothing for them, so every status is worded here.
 */
export function refusalOf(status: number, body: unknown): Refusal {
  const b = (typeof body === 'object' && body !== null ? body : {}) as { errormessage?: unknown; hint?: unknown; fields?: unknown };
  if (status === 400) {
    const fields: FieldProblem[] = (Array.isArray(b.fields) ? b.fields : [])
      .map((f) => (typeof f === 'object' && f !== null ? (f as { field?: unknown; message?: unknown }) : {}))
      .map((f) => ({ field: word(f.field), message: word(f.message) }))
      .filter((f) => f.message !== '');
    return {
      kind: 'invalid',
      message: word(b.errormessage) || "This curriculum can't be published yet.",
      hint: word(b.hint),
      fields,
    };
  }
  if (status === 409) return { kind: 'conflict', message: CONFLICT_MESSAGE };
  if (status === 404) return { kind: 'missing' };
  if (status === 403) return { kind: 'forbidden', message: NO_PERMISSION_MESSAGE };
  if (status === 0 || status === 502 || status === 503) return { kind: 'gateway' };
  if (status === 429) return { kind: 'other', message: 'Too many attempts. Wait a minute and try again.' };
  return { kind: 'other', message: word(b.errormessage) || FALLBACK_MESSAGE };
}

// ---- What the publish drawer says -------------------------------------------------------------------------

/** The most names the drawer lists under one heading; the rest are "and N more" (the API's own cap is 200, counts are exact). */
export const NAME_CAP = 10;

/** One heading of named rows: "Lessons added" with up to NAME_CAP names, and how many more there are. */
export interface NameSection {
  id: string;
  title: string;
  names: string[];
  more: number;
}

/** A question or document a publish carries that other curricula of the organisation also use. */
export interface SharedView {
  name: string;
  kind: 'question' | 'document';
  /** The other curricula's names. */
  alsoIn: string[];
}

/** The rows a publish removes that now live under another curriculum, with the API's sentence about them. */
export interface MovedView {
  message: string;
  rows: string[];
  more: number;
}

export interface PublishView {
  /** `whole`: never published or retired, so all of it reaches learners (no diff); `nochange`; `changes`. */
  mode: 'whole' | 'nochange' | 'changes';
  /** The one-line total: "3 lessons added, 1 changed, 2 questions removed". */
  headline: string;
  sections: NameSection[];
  shared: SharedView[];
  moved: MovedView | null;
  /** "Translations: km: 2 untranslated; fr: translated", or null while the organisation has no translations. */
  coverage: string | null;
  /** "Re-publish" when nothing has changed (the API still records a publication and pushes), else "Publish". */
  publishLabel: 'Publish' | 'Re-publish';
  /** The API's sentence when the rows cannot be published as they are; null otherwise. */
  problem: string | null;
}

const KINDS = ['added', 'changed', 'removed'] as const;
type Kind = (typeof KINDS)[number];

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

const changeOf = (summary: SlimSummary, table: string): TableChange => {
  const c = summary.changes?.[table];
  return { added: c?.added ?? 0, changed: c?.changed ?? 0, removed: c?.removed ?? 0 };
};

/** "3 lessons added, 1 changed": the noun is said once, with the first count of its table. */
function phrase(noun: [string, string], c: TableChange): string[] {
  const parts: string[] = [];
  for (const kind of KINDS) {
    const n = c[kind];
    if (n <= 0) continue;
    parts.push(parts.length === 0 ? `${count(n, noun[0], noun[1])} ${kind}` : `${n} ${kind}`);
  }
  return parts;
}

function sectionsFor(summary: SlimSummary, table: 'lessons' | 'questions', title: string, cap: number): NameSection[] {
  const exact = changeOf(summary, table);
  const named = summary.affected?.[table] ?? { added: [], changed: [], removed: [] };
  const out: NameSection[] = [];
  for (const kind of KINDS as readonly Kind[]) {
    const names = (named[kind] ?? []).map((r) => r.name);
    const total = Math.max(exact[kind], names.length);
    if (total <= 0) continue;
    const shown = names.slice(0, cap);
    out.push({ id: `${table}-${kind}`, title: `${title} ${kind}`, names: shown, more: Math.max(0, total - shown.length) });
  }
  return out;
}

const SINGULAR: Record<string, string> = { grades: 'Grade', levels: 'Level', lessons: 'Lesson' };

/** What a publish would do, as the drawer says it. Pure: the same overview always reads the same. */
export function viewOf(overview: PublicationOverview, cap: number = NAME_CAP): PublishView {
  const coverageChips = curriculumChips(overview.translationcoverage);
  const coverage = coverageChips.length > 0 ? `Translations: ${coverageChips.map((c) => c.text).join('; ')}` : null;
  const problem = typeof overview.problem === 'string' && overview.problem.trim() !== '' ? overview.problem.trim() : null;
  const summary = overview.pending;
  if (summary === null || summary === undefined) {
    const retired = overview.publicationstatus === 'withdrawn';
    return {
      mode: 'whole',
      headline: retired
        ? 'This curriculum is retired. All of it reaches learners again on this publish.'
        : 'This curriculum has not been published. All of it reaches learners on this publish.',
      sections: [],
      shared: [],
      moved: null,
      coverage,
      publishLabel: 'Publish',
      problem,
    };
  }

  const lessons = changeOf(summary, 'lessons');
  const questions = changeOf(summary, 'questions');
  let other = 0;
  for (const [table, c] of Object.entries(summary.changes ?? {})) {
    if (table === 'lessons' || table === 'questions') continue;
    other += (c?.added ?? 0) + (c?.changed ?? 0) + (c?.removed ?? 0);
  }
  const parts = [...phrase(['lesson', 'lessons'], lessons), ...phrase(['question', 'questions'], questions)];
  if (other > 0) parts.push(count(other, 'other change', 'other changes'));

  const movedRows = summary.movedaway ?? [];
  const moved: MovedView | null =
    movedRows.length > 0 || (summary.movedawaymessage ?? '').trim() !== ''
      ? {
          message: (summary.movedawaymessage ?? '').trim(),
          rows: movedRows.slice(0, cap).map((m) => `${SINGULAR[m.table] ?? m.table} “${m.name}” now lives under “${m.tocurriculum?.name ?? ''}”.`),
          more: Math.max(0, movedRows.length - cap),
        }
      : null;

  const shared: SharedView[] = (summary.shared ?? []).map((r) => ({
    name: r.name,
    kind: r.table === 'documents' ? 'document' : 'question',
    alsoIn: (r.curricula ?? []).map((c) => c.name),
  }));

  if (parts.length === 0 && moved === null) {
    return {
      mode: 'nochange',
      headline: 'Nothing has changed since the last publish.',
      sections: [],
      shared,
      moved: null,
      coverage,
      publishLabel: 'Re-publish',
      problem,
    };
  }
  return {
    mode: 'changes',
    headline: parts.join(', ') || 'Rows moved to other curricula.',
    sections: [...sectionsFor(summary, 'lessons', 'Lessons', cap), ...sectionsFor(summary, 'questions', 'Questions', cap)],
    shared,
    moved,
    coverage,
    publishLabel: 'Publish',
    problem,
  };
}
