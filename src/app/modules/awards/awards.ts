import { IMultiPaging } from 'src/app/models/IPaging';
import { environment } from 'src/environments/environment';

/**
 * A learner's level awards, as the API answers them (`POST report/student-awards` and `POST report/online/student-awards`;
 * the same rows from either). The names are null when the level, grade or curriculum can no longer be read: an award
 * outlives its level.
 */
export interface StudentAward {
  studentawardid: string;
  levelid: string;
  levelname: string | null;
  levelorder: number | null;
  gradeid: string;
  gradename: string | null;
  curid: string;
  curriculumname: string | null;
  earnedat: string;
  earnedat_approximate: boolean;
}

/** What the screen shows where the API has no name. */
export const NO_NAME = '—';

export const APPROXIMATE_HINT = 'The exact date was not recorded';
export const EMPTY_MESSAGE = 'No awards yet.';
export const ERROR_MESSAGE = 'Awards could not be loaded. Try again in a moment.';
export const FORBIDDEN_MESSAGE = "You don't have permission to see awards.";

/** What to say for a failed request: a role failure (403) is not "try again". */
export function awardsErrorMessage(status: number | null | undefined): string {
  return status === 403 ? FORBIDDEN_MESSAGE : ERROR_MESSAGE;
}

/** The permissions that let staff see awards: the ones the API asks for on the two routes, and the platform account. */
export const AWARDS_OFFLINE_PERMISSIONS = ['view_offline_report', 'superadmin'];
export const AWARDS_ONLINE_PERMISSIONS = ['view_online_report', 'superadmin'];

/**
 * Which server holds this deployment's learners: `learningServer` in the environment file ('online' | 'offline'). A file
 * that does not have the field (an older deployed environment file) means 'online'; anything but 'offline' is 'online'.
 */
export type LearningServer = 'online' | 'offline';
export function learningServerOf(setting: unknown): LearningServer {
  return setting === 'offline' ? 'offline' : 'online';
}

/**
 * The one place that decides the route for the learner page's Awards section: online deployments ask
 * `report/online/student-awards` (permission view_online_report), offline ones `report/student-awards` (view_offline_report).
 * The gate and the call both use `learnerAwardsOnline()`, so they cannot disagree. An online failure is never retried on the
 * other route.
 */
export function awardsOnlineFor(setting: unknown): boolean {
  return learningServerOf(setting) === 'online';
}
export function awardsPermissionsFor(setting: unknown): string[] {
  return awardsOnlineFor(setting) ? AWARDS_ONLINE_PERMISSIONS : AWARDS_OFFLINE_PERMISSIONS;
}
/** This build's decision, from the environment file. */
export const learnerAwardsOnline = (): boolean => awardsOnlineFor((environment as { learningServer?: string }).learningServer);
export const learnerAwardsPermissions = (): string[] => awardsPermissionsFor((environment as { learningServer?: string }).learningServer);

/** The request for one learner's awards (the same filters as the level-progress report). */
export function awardsRequest(studentid: string, gradeid = '', pagesize = 200, pageindex = 1): IMultiPaging {
  const filter = [{ key: 'studentid', value: studentid }];
  if (gradeid) filter.push({ key: 'gradeid', value: gradeid });
  return { pageindex, pagesize, filter };
}

/** Newest first, whatever order the rows came in (a stable sort; ties keep the API's order). */
export function newestFirst(rows: StudentAward[]): StudentAward[] {
  return [...rows].sort((a, b) => new Date(b.earnedat).getTime() - new Date(a.earnedat).getTime());
}

/** "3 earned · 1 with an approximate date". */
export function awardsSummary(earned: number, approximate: number): string {
  if (earned === 0) return '';
  return approximate > 0 ? `${earned} earned · ${approximate} with an approximate date` : `${earned} earned`;
}

export const nameOrDash = (name: string | null | undefined): string => (name ? name : NO_NAME);
