import { expect, test } from '@playwright/test';
import { pageMakesSenseInAnyContext } from '../../src/app/modules/shell/org-context';

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
