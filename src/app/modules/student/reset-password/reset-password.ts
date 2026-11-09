/**
 * The request, the wording and the reading of failures for Reset password on the Learners and Teachers lists, kept free
 * of Angular so they can be checked in plain Node. The request is `PUT student/:schooluserid/password` or
 * `PUT teacher/:schooluserid/password` with `{ password }`. The password rule, its message and the generator are the
 * Add learner drawer's, imported as they are.
 */
import { HttpFailure, PASSWORD_RULE_MESSAGE, PushStatus } from '../add-learner/add-learner-form';
import type { AccountKind } from '../account-disable';

export const RESET_NO_ACCESS_MESSAGE = "You don't have permission to reset passwords.";
export const RESET_NOT_FOUND_MESSAGE = 'That account no longer exists. Close this and try again.';
export const RESET_SAVE_FAILED = "The password couldn't be changed. Try again.";
export const RESET_INVALID_MESSAGE = "Some of the information isn't valid. Close this and try again.";
export const DISABLED_NOTE = "This account is disabled. It can't sign in until you enable it.";
export const WRITE_IT_DOWN = 'Write it down or copy it now; it is not shown again.';

/** The body of `PUT .../password`: this key and no other. */
export interface ResetPasswordBody {
  password: string;
}
export const resetBody = (password: string): ResetPasswordBody => ({ password });

/** The answer of the password endpoints. */
export interface ResetResult {
  schooluserid: string;
  schoolusername?: string;
  push?: { status?: PushStatus; message?: string };
}

/** The line in the done panel after a 200: what the push to the learning server means for signing in with it. */
export function resetDoneLine(kind: AccountKind, username: string, push?: ResetResult['push'], disabled = false): { tone: 'ok' | 'warn' | 'info'; text: string } {
  const sync = kind === 'teacher' ? 'Sync Teachers' : 'Sync Students';
  switch (push?.status) {
    case 'pushed':
      if (disabled) {
        return { tone: 'info', text: `${username} can sign in with the new password once you enable the account. Anyone signed in with the old one has been signed out.` };
      }
      return { tone: 'ok', text: `${username} can sign in with the new password now. Anyone signed in with the old one has been signed out.` };
    case 'failed':
      return {
        tone: 'warn',
        text: `The learning server did not answer, so the old password still works there. Run ${sync} for this school on the Schools screen.`,
      };
    case 'skipped':
      return { tone: 'info', text: 'The learning server gets the new password at its next sync.' };
    default:
      return { tone: 'info', text: `${username}'s password was changed.` };
  }
}

/** A failed save as the message beside Password, or one for the form. Statuses the interceptor toasts say nothing here. */
export function resetErrors(error: HttpFailure): { password?: string; form?: string } {
  if ([0, 429, 500, 502, 503].includes(error.status)) return {};
  const body = (error.error && typeof error.error === 'object' ? error.error : {}) as {
    errormessage?: unknown;
    fields?: Array<{ field?: string; message?: string }>;
  };
  if (error.status === 400) {
    const fields = Array.isArray(body.fields) ? body.fields : [];
    const named = fields.find((f) => f?.field === 'password');
    if (named) return { password: typeof named.message === 'string' && named.message.trim() ? named.message : PASSWORD_RULE_MESSAGE };
    // No organisation chosen, or any other refusal: the API's sentence is for the form.
    const other = fields.find((f) => typeof f?.message === 'string' && f.message.trim());
    const sentence = typeof body.errormessage === 'string' && body.errormessage.trim() ? body.errormessage : other?.message;
    return { form: sentence || RESET_INVALID_MESSAGE };
  }
  if (error.status === 403) return { form: RESET_NO_ACCESS_MESSAGE };
  if (error.status === 404) return { form: RESET_NOT_FOUND_MESSAGE };
  return { form: RESET_SAVE_FAILED };
}

