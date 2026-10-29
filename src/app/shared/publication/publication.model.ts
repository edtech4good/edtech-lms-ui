import { format } from 'date-fns';
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
