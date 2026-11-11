import { IMultiPaging } from 'src/app/models/IPaging';

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

/** The permissions that let staff see awards: the ones the API asks for on the two routes, and the platform account. */
export const AWARDS_OFFLINE_PERMISSIONS = ['view_offline_report', 'superadmin'];
export const AWARDS_ONLINE_PERMISSIONS = ['view_online_report', 'superadmin'];

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
