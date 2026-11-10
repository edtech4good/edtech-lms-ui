import { expect, test } from '@playwright/test';
import { REMOVE_FAILED_MESSAGE, canRemove, removeConfirmText, removeFailureText, removedText } from '../../src/app/modules/student/account-remove';

/** The wording and the visibility rule of Remove on the Learners list (account-remove.ts), in Node. The list in a browser is remove-learner.spec.ts. */

test.describe('canRemove', () => {
  test('is true only for a row with no last sign-in', () => {
    expect(canRemove({})).toBe(true);
    expect(canRemove({ lastlogin: null })).toBe(true);
    expect(canRemove({ lastlogin: '' })).toBe(true);
    expect(canRemove({ lastlogin: '2026-11-01T08:00:00.000Z' })).toBe(false);
    expect(canRemove(null)).toBe(false);
    expect(canRemove(undefined)).toBe(false);
  });
});

test.describe('the confirm text', () => {
  test('names the learner and says it cannot be undone and who can be removed', () => {
    expect(removeConfirmText('dara1')).toBe("Remove dara1? This can't be undone. Only a learner who has never signed in can be removed.");
  });
});

test.describe('the success text', () => {
  test("is central's sentence when it sent one, a plain one otherwise", () => {
    expect(removedText({ message: 'Removed. The username dara1 can be used again.' }, 'dara1')).toBe('Removed. The username dara1 can be used again.');
    expect(removedText({}, 'dara1')).toBe('dara1 was removed. The username can be used again.');
    expect(removedText(null, 'dara1')).toBe('dara1 was removed. The username can be used again.');
    expect(removedText({ message: '   ' }, 'dara1')).toBe('dara1 was removed. The username can be used again.');
  });
});

test.describe('the failure text', () => {
  test("passes central's sentence through", () => {
    const said = "This learner has signed in or has progress, so it can't be removed. Disable it instead.";
    expect(removeFailureText({ status: 409, error: { error: true, errormessage: said } })).toBe(said);
    expect(removeFailureText({ status: 503, error: { errormessage: "  The learning server didn't answer, so nothing was removed. Try again later. " } })).toBe(
      "The learning server didn't answer, so nothing was removed. Try again later.",
    );
  });
  test('falls back to a fixed sentence when there are no words', () => {
    expect(REMOVE_FAILED_MESSAGE).toBe('The learner was not removed.');
    for (const error of [null, undefined, {}, { error: null }, { error: {} }, { error: { errormessage: '' } }, { error: { errormessage: 5 } }, { status: 0, error: { isTrusted: true, type: 'error' } }]) {
      expect(removeFailureText(error)).toBe(REMOVE_FAILED_MESSAGE);
    }
  });
});
