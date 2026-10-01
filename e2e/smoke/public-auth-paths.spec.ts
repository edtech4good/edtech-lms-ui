import { expect, test } from '@playwright/test';
import { isPublicAuthPath } from '../../src/app/services/public-auth-paths';

/**
 * Which paths a signed-out user may see (CoreService.ignoreToken). Plain Node, no
 * browser: the app's own unit-test runner (karma) is not run by CI and its specs
 * are scaffolding, and no route reaches this function for an unrouted path like
 * /auth/loginx, so the boundary cannot be seen through the browser.
 */
test.describe('public auth paths', () => {
  const PUBLIC = [
    '/auth/login',
    '/auth/login/',
    '/auth/login/anything',
    '/auth/changepassword/abc',
    '/auth/changepassword',
    '/auth/verify/abc',
    '/auth/verify',
  ];
  const NOT_PUBLIC = [
    '/auth/loginx',
    '/auth/loginx/foo',
    '/auth/verifyx',
    '/auth/verifyx/abc',
    '/auth/changepasswordx',
    '/auth/changepasswordx/abc',
    '/auth',
    '/auth/blocked',
    '/auth/Login',
    '/login',
    '/question/index',
    '/dashboard/index',
    '/',
    '',
  ];

  test('the sign-in page and the emailed links are public, with or without a trailing part', () => {
    for (const path of PUBLIC) {
      expect(isPublicAuthPath(path), `${JSON.stringify(path)} is public`).toBe(true);
    }
  });

  test('a longer name that merely starts with one of them, and every other page, is not', () => {
    for (const path of NOT_PUBLIC) {
      expect(isPublicAuthPath(path), `${JSON.stringify(path)} is not public`).toBe(false);
    }
  });
});
