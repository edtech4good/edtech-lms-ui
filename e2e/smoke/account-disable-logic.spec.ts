import { expect, test } from '@playwright/test';
import { deleteNotice, disableConfirmText, disableNotice, noticeOptions, withDisabled } from '../../src/app/modules/student/account-disable';

/** The wording and the row update of Disable / Enable (account-disable.ts), in Node. The lists in a browser are account-disable.spec.ts. */

/** Central's two real sentences for a push that failed: the learning server did not answer, or it lacks the class or curriculum. */
const CENTRAL_SYNC_MESSAGE = "The change was saved, but the learning server did not answer. Run Sync Students for this school on the Schools screen.";
const CENTRAL_MISSING_MESSAGE = "Saved, but the learning server doesn't have this class or curriculum yet. Run Sync Content, then Sync Students for this school.";

test.describe('the confirm text', () => {
  test('says what disabling and enabling mean for sign-in and progress', () => {
    expect(disableConfirmText('dara1', true)).toBe("Disable dara1? They won't be able to sign in. Their progress is kept.");
    expect(disableConfirmText('dara1', false)).toBe('Enable dara1? They can sign in again.');
  });
});

test.describe('the toast after a 200', () => {
  test('a pushed change says the account is disabled or can sign in again', () => {
    expect(disableNotice('learner', 'dara1', { disabled: true, push: { status: 'pushed' } })).toMatchObject({ type: 'success', text: 'dara1 is disabled.' });
    expect(disableNotice('learner', 'dara1', { disabled: false, push: { status: 'pushed' } })).toMatchObject({ type: 'success', text: 'dara1 can sign in again.' });
  });
  test('a failed push names the Sync button for the account kind, for disable and enable', () => {
    expect(disableNotice('learner', 'dara1', { disabled: true, push: { status: 'failed' } })).toMatchObject({
      type: 'warning',
      text: 'dara1 is disabled on central, but the learning server did not answer. Run Sync Students for this school on the Schools screen.',
    });
    expect(disableNotice('teacher', 'dara1', { disabled: true, push: { status: 'failed' } }).text).toBe(
      'dara1 is disabled on central, but the learning server did not answer. Run Sync Teachers for this school on the Schools screen.',
    );
    expect(disableNotice('learner', 'dara1', { disabled: false, push: { status: 'failed' } }).text).toBe(
      'dara1 is enabled on central, but the learning server did not answer. Run Sync Students for this school on the Schools screen.',
    );
  });
  test("a learner's failed push shows central's own sentence, trimmed; a teacher's is unchanged", () => {
    for (const message of [CENTRAL_SYNC_MESSAGE, CENTRAL_MISSING_MESSAGE]) {
      for (const disabled of [true, false]) {
        expect(disableNotice('learner', 'dara1', { disabled, push: { status: 'failed', message: ` ${message} ` } })).toEqual({ type: 'warning', title: 'Saved', duration: 0, text: `dara1 is ${disabled ? 'disabled' : 'enabled'} on central. ${message}` });
      }
    }
    expect(disableNotice('learner', 'dara1', { disabled: true, push: { status: 'failed', message: '  ' } }).text).toBe(
      'dara1 is disabled on central, but the learning server did not answer. Run Sync Students for this school on the Schools screen.',
    );
    expect(disableNotice('teacher', 'dara1', { disabled: true, push: { status: 'failed', message: CENTRAL_SYNC_MESSAGE } }).text).toBe(
      'dara1 is disabled on central, but the learning server did not answer. Run Sync Teachers for this school on the Schools screen.',
    );
  });
  test('a skipped push says the learning server gets the change at its next sync', () => {
    expect(disableNotice('teacher', 'dara1', { disabled: true, push: { status: 'skipped' } })).toMatchObject({
      type: 'info',
      text: 'dara1 is disabled. The learning server gets the change at its next sync.',
    });
    expect(disableNotice('teacher', 'dara1', { disabled: false, push: { status: 'skipped' } }).text).toBe(
      'dara1 is enabled. The learning server gets the change at its next sync.',
    );
  });
  test('an answer with no push status, or an unknown one, gets a neutral toast', () => {
    for (const disabled of [true, false]) {
      expect(disableNotice('learner', 'dara1', { disabled })).toEqual({ type: 'info', title: 'Saved', text: 'dara1 was updated.' });
      expect(disableNotice('teacher', 'dara1', { disabled, push: {} }).text).toBe('dara1 was updated.');
      expect(disableNotice('teacher', 'dara1', { disabled, push: { status: 'later' as never } }).text).toBe('dara1 was updated.');
    }
  });
  test('every toast title is Saved or Success, never a place name', () => {
    for (const status of ['pushed', 'failed', 'skipped', undefined] as const) {
      expect(['Saved', 'Success']).toContain(disableNotice('learner', 'dara1', { disabled: true, push: { status } }).title);
    }
    expect(disableNotice('learner', 'dara1', { disabled: true, push: { status: 'failed' } }).title).toBe('Saved');
  });
  test('the teacher text never names learners', () => {
    for (const status of ['pushed', 'failed', 'skipped'] as const) {
      expect(disableNotice('teacher', 'dara1', { disabled: true, push: { status } }).text).not.toContain('Sync Students');
    }
  });
});

test.describe('the row update', () => {
  const rows = [
    { schooluserid: 'a', isdisabled: false, name: 'one' },
    { schooluserid: 'b', isdisabled: false, name: 'two' },
  ];
  test('sets one row and leaves the others and the input as they were', () => {
    const next = withDisabled(rows, 'b', true);
    expect(next.map((r) => r.isdisabled)).toEqual([false, true]);
    expect(next[1].name).toBe('two');
    expect(next[0]).toBe(rows[0]);
    expect(rows[1].isdisabled).toBe(false);
  });
  test('an unknown id changes nothing', () => {
    expect(withDisabled(rows, 'zzz', true)).toEqual(rows);
  });
});

test.describe('the toast after a teacher is deleted', () => {
  test("passes central's sentence through, with the type for each push outcome", () => {
    expect(deleteNotice({ push: { status: 'pushed', message: ' Deleted. The teacher can no longer sign in. ' } })).toEqual({ type: 'success', title: 'Success', text: 'Deleted. The teacher can no longer sign in.' });
    expect(deleteNotice({ push: { status: 'skipped', message: 'Deleted. Nothing was pushed.' } })).toMatchObject({ type: 'success', text: 'Deleted. Nothing was pushed.' });
    expect(deleteNotice({ push: { status: 'failed', message: 'Deleted, but it did not answer.' } })).toMatchObject({ type: 'warning', text: 'Deleted, but it did not answer.' });
  });
  test('an answer without push (an older server) says the teacher was deleted', () => {
    for (const result of [undefined, null, {}, { push: undefined }]) expect(deleteNotice(result)).toEqual({ type: 'success', title: 'Success', text: 'Teacher deleted.' });
  });
  test('a failed push with no message still names Sync Teachers', () => {
    expect(deleteNotice({ push: { status: 'failed' } })).toMatchObject({ type: 'warning', text: 'Deleted, but the learning server did not answer. Run Sync Teachers for this school on the Schools screen.' });
  });
});

test.describe('how long a notice stays', () => {
  test('a failed push stays until it is closed, for Disable and Delete', () => {
    for (const kind of ['learner', 'teacher'] as const) {
      expect(disableNotice(kind, 'dara1', { disabled: true, push: { status: 'failed' } }).duration).toBe(0);
    }
    expect(deleteNotice({ push: { status: 'failed', message: 'x' } }).duration).toBe(0);
    expect(deleteNotice({ push: { status: 'failed' } }).duration).toBe(0);
  });
  test('any other outcome keeps the default duration', () => {
    for (const push of [{ status: 'pushed' as const }, { status: 'skipped' as const }, {}, undefined]) {
      expect(disableNotice('teacher', 'dara1', { disabled: true, push }).duration).toBeUndefined();
    }
    for (const result of [{ push: { status: 'pushed' as const, message: 'm' } }, { push: { status: 'skipped' as const, message: 'm' } }, {}, null, undefined]) {
      expect(deleteNotice(result).duration).toBeUndefined();
    }
  });
  test('the options carry 0 for a failed push and nothing otherwise', () => {
    expect(noticeOptions({ duration: 0 })).toEqual({ nzDuration: 0 });
    expect(noticeOptions({})).toEqual({});
  });
});
