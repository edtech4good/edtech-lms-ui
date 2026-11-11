/**
 * A learner's grade, kept free of Angular so the rules can be checked in plain Node.
 *
 * The central API requires a learner's grade to belong to the learner's PRIMARY curriculum: the first of the curricula
 * chosen (on an edit or a move, the curriculum the learner already has as primary while it is still in the list).
 * These helpers say what the form shows and sends for that curriculum's grades. The server decides every rule; this says
 * the same thing sooner, in the same words.
 */

export interface GradeOption {
  label: string;
  value: string;
}

/** What the grades of the primary curriculum came to: nothing chosen yet, loading, failed, none, exactly one, or several. */
export type GradeKind = 'idle' | 'loading' | 'error' | 'none' | 'one' | 'several';

export type GradeLoad = 'idle' | 'loading' | 'ready' | 'error';

/** What the field tells its form: the kind, the options and the grade the form sends (when it can). */
export interface GradeState {
  kind: GradeKind;
  options: GradeOption[];
  /** The primary curriculum the grades belong to; null when none is chosen. */
  curriculumId: string | null;
}

export const IDLE_GRADE_STATE: GradeState = { kind: 'idle', options: [], curriculumId: null };

/** Central's sentence for a curriculum with no grade, shown under the curriculum field. */
export const GRADE_NONE_MESSAGE = "This curriculum has no grade yet, so a learner can't be put in it.";
export const GRADE_CHOOSE_MESSAGE = 'Choose a grade for this student.';
export const GRADE_LOAD_FAILED_MESSAGE = "This curriculum's grades couldn't be loaded.";
export const GRADE_LOADING_MESSAGE = "Wait for the curriculum's grades to load.";

/** The grades `GET grade/curriculum/:curriculumid` answers (only what is read here), in their own order. */
export function gradeOptionsOf(answer: unknown): GradeOption[] {
  const rows = (answer && typeof answer === 'object' ? (answer as { data?: unknown }).data : undefined) as unknown;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((g) => g && typeof g === 'object' && !(g as { isdeleted?: unknown }).isdeleted && typeof (g as { gradeid?: unknown }).gradeid === 'string' && typeof (g as { gradename?: unknown }).gradename === 'string')
    .map((g, index) => ({ g: g as { gradeid: string; gradename: string; gradeorder?: unknown }, index }))
    .sort((a, b) => {
      const ao = typeof a.g.gradeorder === 'number' ? a.g.gradeorder : Number.MAX_SAFE_INTEGER;
      const bo = typeof b.g.gradeorder === 'number' ? b.g.gradeorder : Number.MAX_SAFE_INTEGER;
      return ao - bo || a.index - b.index;
    })
    .map(({ g }) => ({ label: g.gradename, value: g.gradeid }));
}

export function gradeKind(load: GradeLoad, options: readonly GradeOption[]): GradeKind {
  if (load === 'idle') return 'idle';
  if (load === 'loading') return 'loading';
  if (load === 'error') return 'error';
  return options.length === 0 ? 'none' : options.length === 1 ? 'one' : 'several';
}

/**
 * The primary curriculum: the first one chosen. When the learner already has a primary curriculum and it is still among
 * the chosen ones, that one stays primary (the API's own rule on an edit or a move).
 */
export function primaryCurriculumId(chosen: readonly string[], currentPrimary?: string | null): string | null {
  if (chosen.length === 0) return null;
  return currentPrimary && chosen.includes(currentPrimary) ? currentPrimary : chosen[0];
}

/** The grade to keep chosen once a curriculum's grades are known: the choice while it belongs, else the preferred grade while it belongs, else none. */
export function reconcileGrade(chosen: string | null, options: readonly GradeOption[], preferred?: string | null): string | null {
  if (chosen && options.some((o) => o.value === chosen)) return chosen;
  if (preferred && options.some((o) => o.value === preferred)) return preferred;
  return null;
}

/** Whether the person picks the grade (several grades); with one it is shown as text, with none or while unknown it is not shown. */
export const gradeSelectShown = (kind: GradeKind): boolean => kind === 'several';

/**
 * The grade the form sends, or undefined to leave `gradeid` out of the body: the only grade of a curriculum that has one,
 * or the one chosen among several while it belongs to the curriculum.
 */
export function gradeToSend(state: Pick<GradeState, 'kind' | 'options'>, chosen: string | null): string | undefined {
  if (state.kind === 'one') return state.options[0].value;
  if (state.kind === 'several' && chosen && state.options.some((o) => o.value === chosen)) return chosen;
  return undefined;
}

/**
 * What stops a save before anything is sent, in the server's words: a curriculum with no grade, grades that did not load
 * or are still loading, several grades with none chosen. `optional` is for an edit or a move that keeps the learner's
 * primary curriculum: the server then keeps the grade the learner has (and asks if it cannot).
 */
export function gradeProblem(state: Pick<GradeState, 'kind' | 'options'>, chosen: string | null, optional = false): string | null {
  switch (state.kind) {
    case 'none':
      return GRADE_NONE_MESSAGE;
    case 'error':
      return GRADE_LOAD_FAILED_MESSAGE;
    case 'loading':
      return GRADE_LOADING_MESSAGE;
    case 'several':
      return optional || (chosen && state.options.some((o) => o.value === chosen)) ? null : GRADE_CHOOSE_MESSAGE;
    default:
      return null;
  }
}

/**
 * Where the messages about the grade are shown. With several grades the Grade select is on the form: our own check
 * (once Save has been pressed) or the server's refusal sits beside it. Without a select the message goes under the
 * curriculum field: a curriculum with no grade says so at once; the server's refusal of a grade is shown there too, so
 * it is never lost when there is no select to put it by.
 */
export function gradeMessages(
  kind: GradeKind,
  problem: string | null,
  server: string | null,
  submitted: boolean,
): { underGrade: string | null; underCurriculum: string | null } {
  if (kind === 'several') return { underGrade: (submitted ? problem : null) ?? server, underCurriculum: null };
  if (kind === 'none') return { underGrade: null, underCurriculum: GRADE_NONE_MESSAGE };
  if (kind === 'loading') return { underGrade: null, underCurriculum: (submitted ? problem : null) ?? server };
  return { underGrade: null, underCurriculum: server };
}

/** The grade a form shows as the learner's: "Grade: Grade 1". */
export const gradeLine = (name: string): string => `Grade: ${name}`;
/** The hint that says which curriculum the grades belong to. */
export const gradeHint = (curriculumName: string): string => (curriculumName ? `In ${curriculumName}` : '');

/** The top-level keys of `POST student/create` for the grade (left out when none). */
export function uploadGrade(state: Pick<GradeState, 'kind' | 'options'>, chosen: string | null): { gradeid?: string } {
  const id = gradeToSend(state, chosen);
  return id ? { gradeid: id } : {};
}
