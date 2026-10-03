import { expect, test } from '@playwright/test';
import { pageMakesSenseInAnyContext, shouldNotifyPlatformReturn } from '../../src/app/modules/shell/org-context';

/**
 * Which pages go Home when the organisation context changes. Plain Node: a function of the URL.
 * A page about one record (an edit or view page, or any id in the path) may not exist in the other context.
 */
test.describe('pageMakesSenseInAnyContext', () => {
  for (const url of [
    '/user/index',
    '/user/create',
    '/organisation',
    '/organisation/',
    '/dashboard/index',
    '/question/index?page=2',
    '/baseline-curriculum/index',
    '/user/index#top',
  ]) {
    test(`${url} stays and reloads`, () => expect(pageMakesSenseInAnyContext(url)).toBe(true));
  }
  for (const url of [
    '/user/update/0b0d7a64-2907-4eaa-a3f8-841bd25c73eb',
    '/user/update/abc',
    '/grade/update/12',
    '/feedback/view/9',
    '/school/schoolcontribute/6c5b1e1a-6d1c-4a0a-8f0e-1d2b3c4d5e6f',
    '/student/details/7',
    '/anything/0B0D7A64-2907-4EAA-A3F8-841BD25C73EB/more',
  ]) {
    test(`${url} goes Home`, () => expect(pageMakesSenseInAnyContext(url)).toBe(false));
  }
});

/** When "You're back to the platform view." is said: only when a refresh dropped the organisation. */
test.describe('shouldNotifyPlatformReturn', () => {
  const acting = { organisationid: 'o1' };
  const platform = { organisationid: null, isplatform: true };
  test('a refresh that drops the organisation says so', () => expect(shouldNotifyPlatformReturn(acting, platform, undefined)).toBe(true));
  test('a switch the person asked for does not', () => {
    expect(shouldNotifyPlatformReturn(acting, platform, null)).toBe(false);
    expect(shouldNotifyPlatformReturn(acting, { organisationid: 'o2', isplatform: true }, 'o2')).toBe(false);
  });
  test('a platform view that stays the platform view does not', () => expect(shouldNotifyPlatformReturn({ organisationid: null }, platform, undefined)).toBe(false));
  test('an organisation kept does not', () => expect(shouldNotifyPlatformReturn(acting, { organisationid: 'o1', isplatform: true }, undefined)).toBe(false));
  test('a sign-out (no claims) does not', () => expect(shouldNotifyPlatformReturn(acting, { organisationid: null, isplatform: false }, undefined)).toBe(false));
});
