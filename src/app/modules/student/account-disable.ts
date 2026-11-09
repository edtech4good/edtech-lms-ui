/**
 * The wording and the row update of Disable / Enable on the Learners and Teachers lists, kept free of Angular so they
 * can be checked in plain Node. The request is `PUT student/:schooluserid/disabled` or `PUT teacher/:schooluserid/disabled`
 * with `{ disabled: boolean }`.
 */
import type { PushStatus } from './add-learner/add-learner-form';

export type AccountKind = 'learner' | 'teacher';

/** The answer of the disabled endpoints. */
export interface DisabledResult {
  schooluserid: string;
  disabled: boolean;
  push?: { status?: PushStatus; message?: string };
}

export interface DisableNotice {
  type: 'success' | 'warning' | 'info';
  title: string;
  text: string;
}

/** What a popconfirm says before the change. */
export function disableConfirmText(username: string, disabling: boolean): string {
  return disabling
    ? `Disable ${username}? They won't be able to sign in. Their progress is kept.`
    : `Enable ${username}? They can sign in again.`;
}

/** The toast after a 200: what the push to the learning server means for signing in. */
export function disableNotice(kind: AccountKind, username: string, result: Pick<DisabledResult, 'disabled' | 'push'>): DisableNotice {
  const disabled = result.disabled;
  const word = disabled ? 'disabled' : 'enabled';
  const sync = kind === 'teacher' ? 'Sync Teachers' : 'Sync Students';
  switch (result.push?.status) {
    case 'failed':
      return {
        type: 'warning',
        title: 'Saved',
        text: `${username} is ${word} on central, but the learning server did not answer. Run ${sync} for this school on the Schools screen.`,
      };
    case 'skipped':
      return { type: 'info', title: 'Saved', text: `${username} is ${word}. The learning server gets the change at its next sync.` };
    case 'pushed':
      return { type: 'success', title: 'Success', text: disabled ? `${username} is disabled.` : `${username} can sign in again.` };
    default:
      return { type: 'info', title: 'Saved', text: `${username} was updated.` };
  }
}

/** Moves focus to the first element matching `selector`, after Angular has drawn the change. */
export function focusSoon(selector: string): void {
  setTimeout(() => (document.querySelector(selector) as HTMLElement | null)?.focus(), 0);
}

/** The confirm button of the open popconfirm, so a keyboard user can reach it (the overlay sits at the end of the page). */
export const CONFIRM_OK_SELECTOR = '.ant-popover .ant-btn-primary';

/** The attribute that marks a row's control, and the selector for one row's. */
export const rowControl = (id: string) => `[data-row-control="${id.replace(/["\\]/g, '')}"]`;

/** The rows with one row's `isdisabled` set. A new array and a new row, so nothing else changes. */
export function withDisabled<T extends { schooluserid?: string; isdisabled?: boolean }>(rows: T[], schooluserid: string, disabled: boolean): T[] {
  return rows.map((row) => (row.schooluserid === schooluserid ? { ...row, isdisabled: disabled } : row));
}
