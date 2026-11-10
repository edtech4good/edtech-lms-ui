/**
 * The wording, the visibility rule and the focus move of "Remove" on the Learners list, kept free of Angular so they can
 * be checked in plain Node. The request is `POST student/:schooluserid/remove` (no body); a learner who has never signed
 * in and has no progress is removed, so the username is free again.
 */
import { rowControl } from './account-disable';

/** The answer of `POST student/:schooluserid/remove`. */
export interface RemoveResult {
  schooluserid?: string;
  username?: string;
  removed?: boolean;
  message?: string;
}

/** What the notice says when the API gave no words of its own for a refusal. */
export const REMOVE_FAILED_MESSAGE = 'The learner was not removed.';

/** Remove is offered only for a row that has never signed in. */
export function canRemove(row: { lastlogin?: unknown } | null | undefined): boolean {
  return !!row && !row.lastlogin;
}

/** What a popconfirm says before the removal. */
export function removeConfirmText(username: string): string {
  return `Remove ${username}? This can't be undone. Only a learner who has never signed in can be removed.`;
}

/** The success notice: central's sentence, else a plain one. */
export function removedText(result: RemoveResult | null | undefined, username: string): string {
  const said = typeof result?.message === 'string' ? result.message.trim() : '';
  return said || `${username} was removed. The username can be used again.`;
}

/** The error notice: central's own sentence passed through, else a fixed one. */
export function removeFailureText(error: unknown): string {
  const said = (error as { error?: { errormessage?: unknown } } | null)?.error?.errormessage;
  return typeof said === 'string' && said.trim() ? said.trim() : REMOVE_FAILED_MESSAGE;
}

/**
 * After a removal the row is gone: focus goes to the next row's Manage button, else the previous row's, else the list
 * heading. `before` is the ids of the rows in order before the removal.
 */
export function focusAfterRemove(before: string[], removed: string, headingSelector: string): void {
  const at = before.indexOf(removed);
  const candidates = [...before.slice(at + 1), ...before.slice(0, Math.max(at, 0)).reverse()];
  let done = false;
  [100, 300, 700, 1200].forEach((delay, i, all) => {
    setTimeout(() => {
      // The list is read again after the removal; wait until the row is gone.
      if (done || document.querySelector(rowControl(removed))) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body && active.isConnected) return; // the user has moved on
      const control = candidates.map((id) => document.querySelector(rowControl(id)) as HTMLElement | null).find((el) => !!el);
      const heading = document.querySelector(headingSelector) as HTMLElement | null;
      if (control) control.focus();
      else if (i === all.length - 1 && heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus();
      } else return;
      done = true;
    }, delay);
  });
}
