import { expect, test } from '@playwright/test';
import { passwordError } from '../../src/app/modules/student/add-learner/add-learner-form';
import {
  DISABLED_NOTE,
  RESET_NOT_FOUND_MESSAGE,
  RESET_NO_ACCESS_MESSAGE,
  RESET_SAVE_FAILED,
  WRITE_IT_DOWN,
  resetBody,
  resetDoneLine,
  resetErrors,
} from '../../src/app/modules/student/reset-password/reset-password';

/** The request body, the wording and the reading of failures of Reset password (reset-password.ts), in Node. The drawer in a browser is reset-password.spec.ts. */

/** Central's two real sentences for a push that failed: the learning server did not answer, or it lacks the class or curriculum. */
const CENTRAL_SYNC_MESSAGE = "The account was saved, but the learning server did not answer. Run Sync Students for this school on the Schools screen.";
const CENTRAL_MISSING_MESSAGE = "Saved, but the learning server doesn't have this class or curriculum yet. Run Sync Content, then Sync Students for this school.";

test.describe('the request body', () => {
  test('is the password and nothing else', () => {
    expect(resetBody('riverlamp47')).toEqual({ password: 'riverlamp47' });
    expect(Object.keys(resetBody('riverlamp47'))).toEqual(['password']);
  });
  test('the rule is the Add learner rule', () => {
    expect(passwordError('riverlamp47')).toBeNull();
    expect(passwordError('short1')).not.toBeNull();
  });
});

test.describe('the line after a 200', () => {
  test('pushed: the account can sign in with the new password and old sessions are gone', () => {
    expect(resetDoneLine('learner', 'dara1', { status: 'pushed' })).toEqual({
      tone: 'ok',
      text: 'dara1 can sign in with the new password now. Anyone signed in with the old one has been signed out.',
    });
    expect(resetDoneLine('teacher', 'teacher.one', { status: 'pushed' }).text).toBe(
      'teacher.one can sign in with the new password now. Anyone signed in with the old one has been signed out.',
    );
  });
  test('pushed on a disabled account: the new password works once the account is enabled', () => {
    expect(resetDoneLine('learner', 'dara1', { status: 'pushed' }, true)).toEqual({
      tone: 'info',
      text: 'dara1 can sign in with the new password once you enable the account. Anyone signed in with the old one has been signed out.',
    });
    expect(resetDoneLine('teacher', 'teacher.one', { status: 'pushed' }, true).text).toContain('once you enable the account');
    expect(resetDoneLine('learner', 'dara1', { status: 'pushed' }, false).text).toContain('can sign in with the new password now');
  });
  test('failed, skipped and neutral lines are the same for a disabled account', () => {
    for (const push of [{ status: 'failed' as const }, { status: 'skipped' as const }, {}]) {
      expect(resetDoneLine('learner', 'dara1', push, true)).toEqual(resetDoneLine('learner', 'dara1', push, false));
    }
  });
  test('failed: the old password still works there, and the Sync button is named for the account kind', () => {
    expect(resetDoneLine('learner', 'dara1', { status: 'failed' })).toEqual({
      tone: 'warn',
      text: 'The learning server did not answer, so the old password still works there. Run Sync Students for this school on the Schools screen.',
    });
    expect(resetDoneLine('teacher', 'dara1', { status: 'failed' }).text).toBe(
      'The learning server did not answer, so the old password still works there. Run Sync Teachers for this school on the Schools screen.',
    );
  });
  test("a learner's failed push shows central's own sentence, trimmed, for an enabled or disabled account; a teacher's is unchanged", () => {
    for (const message of [CENTRAL_SYNC_MESSAGE, CENTRAL_MISSING_MESSAGE]) {
      for (const disabled of [true, false]) {
        expect(resetDoneLine('learner', 'dara1', { status: 'failed', message: ` ${message} ` }, disabled)).toEqual({ tone: 'warn', text: message });
      }
    }
    expect(resetDoneLine('learner', 'dara1', { status: 'failed', message: '' }).text).toContain('Run Sync Students for this school');
    expect(resetDoneLine('teacher', 'dara1', { status: 'failed', message: CENTRAL_SYNC_MESSAGE }).text).toBe(
      'The learning server did not answer, so the old password still works there. Run Sync Teachers for this school on the Schools screen.',
    );
  });
  test('skipped: the learning server gets the password at its next sync', () => {
    for (const kind of ['learner', 'teacher'] as const) {
      expect(resetDoneLine(kind, 'dara1', { status: 'skipped' })).toEqual({
        tone: 'info',
        text: 'The learning server gets the new password at its next sync.',
      });
    }
  });
  test('no push, an empty push or an unknown status gets the neutral line', () => {
    expect(resetDoneLine('learner', 'dara1')).toEqual({ tone: 'info', text: "dara1's password was changed." });
    expect(resetDoneLine('teacher', 'dara1', {}).text).toBe("dara1's password was changed.");
    expect(resetDoneLine('learner', 'dara1', { status: 'later' as never }).text).toBe("dara1's password was changed.");
  });
  test('the teacher lines never name learners', () => {
    for (const status of ['pushed', 'failed', 'skipped'] as const) {
      expect(resetDoneLine('teacher', 'dara1', { status }).text).not.toContain('Sync Students');
    }
  });
  test('the fixed sentences', () => {
    expect(WRITE_IT_DOWN).toBe('Write it down or copy it now; it is not shown again.');
    expect(DISABLED_NOTE).toBe("This account is disabled. It can't sign in until you enable it.");
  });
});

test.describe('reading a failed save', () => {
  test('a 400 naming the password field shows the API sentence beside Password', () => {
    expect(resetErrors({ status: 400, error: { fields: [{ field: 'password', message: 'Use 8 to 32 characters.' }] } })).toEqual({
      password: 'Use 8 to 32 characters.',
    });
  });
  test('a 400 naming the password field with no sentence falls back to the rule', () => {
    expect(resetErrors({ status: 400, error: { fields: [{ field: 'password' }] } }).password).toContain('Use 8 to 32 characters');
  });
  test('a 400 naming another field (no organisation chosen) is the API sentence for the form', () => {
    expect(resetErrors({ status: 400, error: { errormessage: 'Choose an organisation.', fields: [{ field: 'schooluserid', message: 'Choose an organisation.' }] } })).toEqual({
      form: 'Choose an organisation.',
    });
    expect(resetErrors({ status: 400, error: { fields: [{ field: 'schooluserid', message: 'Choose an organisation.' }] } })).toEqual({ form: 'Choose an organisation.' });
  });
  test('a 400 with nothing readable still says something', () => {
    expect(resetErrors({ status: 400 }).form).toBeTruthy();
  });
  test('403, 404 and other statuses have their own sentences', () => {
    expect(resetErrors({ status: 403 })).toEqual({ form: RESET_NO_ACCESS_MESSAGE });
    expect(resetErrors({ status: 404 })).toEqual({ form: RESET_NOT_FOUND_MESSAGE });
    expect(resetErrors({ status: 409 })).toEqual({ form: RESET_SAVE_FAILED });
  });
  test('statuses the error interceptor already toasts say nothing here', () => {
    for (const status of [0, 429, 500, 502, 503]) expect(resetErrors({ status })).toEqual({});
  });
});
