/**
 * The words of the Learner progress report. Plain TypeScript, no Angular, so it is tested in plain Node
 * (e2e/smoke/learner-progress-logic.spec.ts). The numbers are the API's; nothing here recomputes a percent.
 */

export interface LearnerCurriculum {
  curriculumid: string;
  curriculumname: string;
  lessonsCompleted: number;
  lessonsTotal: number;
  percent: number;
  levelsCompleted: number;
  levelsTotal: number;
  currentLevel: { levelid: string; levelname: string } | null;
}

export interface LearnerProgressRow {
  studentid: string;
  username: string;
  firstname: string;
  lastname: string;
  schoolid: string;
  schoolname: string;
  standard: string;
  classname: string;
  status: 'enabled' | 'disabled';
  curricula: LearnerCurriculum[];
  lastlogin: string | null;
  lastprogressat: string | null;
}

export const NONE = '—';

/** "12 of 40 lessons · 30%", or a dash when the curriculum has no lessons. */
export function progressLabel(c: Pick<LearnerCurriculum, 'lessonsCompleted' | 'lessonsTotal' | 'percent'>): string {
  if (!(c.lessonsTotal > 0)) return NONE;
  return `${c.lessonsCompleted} of ${c.lessonsTotal} lessons · ${c.percent}%`;
}

/** "2 of 6", or a dash when there are no modules. */
export function modulesLabel(c: Pick<LearnerCurriculum, 'levelsCompleted' | 'levelsTotal'>): string {
  if (!(c.levelsTotal > 0)) return NONE;
  return `${c.levelsCompleted} of ${c.levelsTotal}`;
}

/** The module the learner is on; "Finished" when there is none but the curriculum has lessons; a dash when it has none. */
export function currentModuleLabel(c: Pick<LearnerCurriculum, 'currentLevel' | 'lessonsTotal'>): string {
  if (c.currentLevel) return c.currentLevel.levelname;
  return c.lessonsTotal > 0 ? 'Finished' : NONE;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The later of the two moments, or null when neither is a date. */
export function lastActive(lastlogin: string | null, lastprogressat: string | null): Date | null {
  const times = [lastlogin, lastprogressat]
    .map((s) => (s ? new Date(s) : null))
    .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
  if (times.length === 0) return null;
  return times.reduce((a, b) => (b.getTime() > a.getTime() ? b : a));
}

/** "25 Nov 2026" (the viewer's own calendar day), or "Never". */
export function lastActiveLabel(lastlogin: string | null, lastprogressat: string | null): string {
  const d = lastActive(lastlogin, lastprogressat);
  if (!d) return 'Never';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** The learner's full name, then the username; either name may be empty. */
export function fullName(r: Pick<LearnerProgressRow, 'firstname' | 'lastname'>): string {
  return [r.firstname, r.lastname].filter((p) => p && p.trim()).join(' ');
}
