/**
 * The request, the wording and the reading of failures for "Move to another school" on the Learners list, kept free of
 * Angular so they can be checked in plain Node. The request is `PUT student/:schooluserid/school` with the three keys of
 * `MoveLearnerBody`; the schools offered are the caller's schools of the learner's own organisation, minus the current one.
 */
import { CLASS_WORD, PushStatus, pushMessageOf } from '../add-learner/add-learner-form';
import { loadFailure } from '../edit-learner/edit-learner';

export const NO_OTHER_SCHOOL_TOOLTIP = 'There is no other school to move to.';
export const MOVE_RESULTS_NOTE = 'Past results move with the learner.';
export const MOVE_FAILED = "The learner couldn't be moved. Try again.";
export const MOVE_NO_ACCESS = "You don't have permission to move learners.";
export const MOVE_SCHOOLS_FAILED = "The schools couldn't be loaded.";

export type MoveFieldKey = 'schoolid' | 'standard' | 'curriculumids' | 'gradeid';
export const MOVE_FIELD_ORDER: readonly MoveFieldKey[] = ['schoolid', 'standard', 'curriculumids', 'gradeid'];

/** The body of `PUT student/:schooluserid/school`: these three keys, and `gradeid` when the form has a grade to send. */
export interface MoveLearnerBody {
  schoolid: string;
  standard: string;
  curriculumids: string[];
  /** A grade of the learner's primary curriculum; left out when none is chosen (the server keeps the current one while it fits). */
  gradeid?: string;
}

/** What the request answers on a 200. */
export interface MoveLearnerResult {
  schooluserid: string;
  username?: string;
  schoolid?: string;
  schoolname?: string;
  push?: { status?: PushStatus; message?: string };
}

export interface MoveOption {
  label: string;
  value: string;
}

/** A school as the schools list answers it (only what is read here). */
export interface SchoolRow {
  schoolid: string;
  schoolname: string;
  organisationid?: string | null;
}

/** The row of the Learners list as far as it is read here. */
export interface LearnerRow {
  schoolid?: string | null;
  organisationid?: string | null;
}

/**
 * The schools a learner can be moved to: those of the learner's own organisation other than the one they are in. The
 * organisation is the row's own, or else the organisation of the learner's current school; when neither is known nothing
 * is offered, because a move across organisations is refused.
 */
export function schoolsToMoveTo(schools: readonly SchoolRow[], row: LearnerRow | null | undefined): MoveOption[] {
  if (!row?.schoolid) return [];
  const current = schools.find((s) => s.schoolid === row.schoolid);
  const organisation = row.organisationid ?? current?.organisationid ?? null;
  if (!organisation) return [];
  return schools
    .filter((s) => s.schoolid !== row.schoolid && s.organisationid === organisation)
    .map((s) => ({ label: s.schoolname, value: s.schoolid }));
}

/** The learner's current curricula that the chosen school also has, in the learner's own order. */
export function keptCurricula(current: readonly string[], available: readonly MoveOption[]): string[] {
  const offered = new Set(available.map((o) => o.value));
  return current.filter((id) => offered.has(id));
}

/** The curricula once a school's lists have both arrived: the learner's kept ones, unless the person has already chosen curricula since the school was chosen. */
export function curriculaAfterPlacement(touched: boolean, picked: readonly string[], current: readonly string[], available: readonly MoveOption[]): string[] {
  return touched ? [...picked] : keptCurricula(current, available);
}

/** The request body for a form the caller has checked. */
export function moveBody(schoolid: string, standard: string, curriculumids: readonly string[], gradeid?: string): MoveLearnerBody {
  return { schoolid, standard, curriculumids: [...curriculumids], ...(gradeid ? { gradeid } : {}) };
}

/** What the form says beside a field before anything is sent; `null` for a field that is fine. */
export function moveFormErrors(
  schoolid: string | null,
  standard: string | null,
  curriculumids: readonly string[],
  gradeProblem: string | null = null,
): Record<MoveFieldKey, string | null> {
  return {
    schoolid: schoolid ? null : 'Choose a school.',
    standard: standard ? null : `Choose a ${CLASS_WORD.toLowerCase()}.`,
    curriculumids: curriculumids.length ? null : 'Choose at least one curriculum.',
    gradeid: gradeProblem,
  };
}

export interface MoveNotice {
  type: 'success' | 'warning' | 'info';
  title: string;
  text: string;
  /** Milliseconds the notice stays; 0 until it is closed. Absent: the default. */
  duration?: number;
}

/** The notice after a 200: central's own sentence about the push, whatever the status says about its tone. */
export function movedNotice(result: Pick<MoveLearnerResult, 'schoolname' | 'push'>): MoveNotice {
  const said = pushMessageOf(result.push);
  const where = result.schoolname && result.schoolname.trim() ? result.schoolname.trim() : 'the new school';
  switch (result.push?.status) {
    case 'pushed':
      return { type: 'success', title: 'Success', text: said || `Moved to ${where}. The learner signs in again to see it.` };
    case 'failed':
      return {
        type: 'warning',
        title: 'Moved',
        duration: 0,
        text: said || `Moved, but the learning server did not answer. Run Sync Students for ${where} on the Schools screen.`,
      };
    case 'skipped':
      return { type: 'info', title: 'Moved', text: said || `Moved to ${where}. No learner server is set up here, so nothing was pushed.` };
    default:
      return { type: 'info', title: 'Moved', text: said || `Moved to ${where}.` };
  }
}

interface FailureShape {
  status: number;
  error?: unknown;
}

const wordOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * The fields of a failed move: a 400's own sentences beside the fields it names; and one sentence for the form: central's
 * own words for every other refusal (a missing learner, more than one record, a server error), a fixed line only when it
 * sent none.
 */
export function moveErrors(error: FailureShape): { fields: Partial<Record<MoveFieldKey, string>>; form?: string } {
  const body = (error.error && typeof error.error === 'object' ? error.error : {}) as {
    errormessage?: unknown;
    fields?: Array<{ field?: unknown; message?: unknown }>;
  };
  const said = wordOf(body.errormessage);
  if (error.status === 400) {
    const fields: Partial<Record<MoveFieldKey, string>> = {};
    let stray = '';
    for (const f of Array.isArray(body.fields) ? body.fields : []) {
      const key = MOVE_FIELD_ORDER.find((k) => k === f?.field);
      const message = wordOf(f?.message);
      if (key) fields[key] = message || 'Check this field.';
      else if (message && !stray) stray = message;
    }
    if (Object.keys(fields).length > 0) return stray ? { fields, form: stray } : { fields };
    return { fields: {}, form: stray || said || MOVE_FAILED };
  }
  if (error.status === 403) return { fields: {}, form: said || MOVE_NO_ACCESS };
  return { fields: {}, form: said || MOVE_FAILED };
}

/** The sentence when the learner's details could not be read (the drawer needs their curricula). */
export const moveLoadFailure = loadFailure;
