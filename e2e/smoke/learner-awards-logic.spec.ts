import { expect, test } from '@playwright/test';
import {
  AWARDS_OFFLINE_PERMISSIONS,
  AWARDS_ONLINE_PERMISSIONS,
  ERROR_MESSAGE,
  FORBIDDEN_MESSAGE,
  awardsErrorMessage,
  awardsOnlineFor,
  awardsPermissionsFor,
  learnerAwardsOnline,
  learnerAwardsPermissions,
  learningServerOf,
} from '../../src/app/modules/awards/awards';

/**
 * Which route and which permission the learner page's Awards section uses, in Node (awards.ts). The build-time environment cannot
 * be switched in a mocked browser spec, so the offline decision is proved here by handing the function each setting; the browser
 * spec (learner-awards.spec.ts) proves the build served there, which has no setting, asks the online route.
 */
test.describe('learningServer decides the route and the gate', () => {
  test('absent (an older environment file) means online: the online route and view_online_report', () => {
    for (const absent of [undefined, null, '', 'ONLINE', 'banana']) {
      expect(learningServerOf(absent)).toBe('online');
      expect(awardsOnlineFor(absent)).toBe(true);
      expect(awardsPermissionsFor(absent)).toEqual(AWARDS_ONLINE_PERMISSIONS);
    }
    expect(AWARDS_ONLINE_PERMISSIONS).toEqual(['view_online_report', 'superadmin']);
  });

  test("'online' is online", () => {
    expect(awardsOnlineFor('online')).toBe(true);
    expect(awardsPermissionsFor('online')).toEqual(AWARDS_ONLINE_PERMISSIONS);
  });

  test("'offline' is the offline route and view_offline_report", () => {
    expect(learningServerOf('offline')).toBe('offline');
    expect(awardsOnlineFor('offline')).toBe(false);
    expect(awardsPermissionsFor('offline')).toEqual(AWARDS_OFFLINE_PERMISSIONS);
    expect(AWARDS_OFFLINE_PERMISSIONS).toEqual(['view_offline_report', 'superadmin']);
  });

  test('the gate and the call agree for every setting', () => {
    for (const setting of [undefined, 'online', 'offline']) {
      const online = awardsOnlineFor(setting);
      expect(awardsPermissionsFor(setting)).toEqual(online ? AWARDS_ONLINE_PERMISSIONS : AWARDS_OFFLINE_PERMISSIONS);
    }
  });

  test("this build's environment file (local) leaves the setting out, so it is online", () => {
    expect(learnerAwardsOnline()).toBe(true);
    expect(learnerAwardsPermissions()).toEqual(AWARDS_ONLINE_PERMISSIONS);
  });
});

test.describe('the failure wording', () => {
  test('a 403 is a permission message; anything else says to try again', () => {
    expect(awardsErrorMessage(403)).toBe(FORBIDDEN_MESSAGE);
    expect(FORBIDDEN_MESSAGE).toBe("You don't have permission to see awards.");
    for (const status of [0, 401, 404, 500, 502, null, undefined]) expect(awardsErrorMessage(status)).toBe(ERROR_MESSAGE);
  });
});
