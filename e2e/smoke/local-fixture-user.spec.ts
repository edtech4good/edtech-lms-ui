import { expect, test } from '@playwright/test';
import { ensureLocalFixtureUser, isLocalHost } from '../fixtures/local-fixture-user';

/**
 * The always-enabled fixture account (organisation.spec.ts) must only ever be made
 * on a local server. Plain Node, no browser: the check is a function of the API URL.
 */
test.describe('local fixture user', () => {
  for (const url of [
    'http://localhost:3000',
    'http://localhost',
    'https://LOCALHOST:3000/auth',
    'http://127.0.0.1:3000',
    'http://[::1]:3000',
  ]) {
    test(`${url} is local`, () => expect(isLocalHost(url)).toBe(true));
  }

  for (const url of [
    'https://uat.example.org',
    'https://uat.example.org:3000',
    'http://localhost.example.org:3000',
    'http://127.0.0.1.example.org',
    'http://notlocalhost:3000',
    'http://example.org/localhost',
    'http://user@example.org:3000/?h=localhost',
    'http://127.0.0.2:3000',
    'not a url',
    '',
  ]) {
    test(`${JSON.stringify(url)} is not local`, () => expect(isLocalHost(url)).toBe(false));
  }

  test('the helper refuses on a non-local host, before sending anything', async () => {
    const sent: string[] = [];
    const fake = {
      post: async (path: string) => {
        sent.push(path);
        return { ok: () => true, status: () => 200, json: async () => ({}) } as never;
      },
    };
    const user = { username: 'someone@example.com', password: 'x', roles: [] };
    await expect(ensureLocalFixtureUser(fake, user, 'https://uat.example.org')).rejects.toThrow(/not a local server/);
    await expect(ensureLocalFixtureUser(fake, user, 'http://localhost.example.org:3000')).rejects.toThrow(/not a local server/);
    expect(sent, 'nothing was sent').toEqual([]);
  });

  test('the helper creates on a local host', async () => {
    const sent: string[] = [];
    const fake = {
      post: async (path: string) => {
        sent.push(path);
        return { ok: () => true, status: () => 200, json: async () => ({}) } as never;
      },
    };
    await ensureLocalFixtureUser(fake, { username: 'someone@example.com', password: 'x', roles: [] }, 'http://127.0.0.1:3000');
    expect(sent).toEqual(['/user/create']);
  });
});
