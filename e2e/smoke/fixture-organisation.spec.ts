import { expect, test } from '@playwright/test';
import { ROLE } from '../fixtures/accounts';
import { FIXTURE_ORGANISATION, fixtureOrganisationId, organisationFor } from '../fixtures/organisation';

/**
 * The fixed organisation the suite's staff accounts belong to is FOUND, and created
 * only on a local API. Plain Node: a fake API context records what is asked of it.
 */
function fakeApi(existing: Array<{ organisationid: string; organisationcode: string }>) {
  const calls: string[] = [];
  const answer = (body: unknown) => ({ ok: () => true, status: () => 200, json: async () => body }) as never;
  return {
    calls,
    api: {
      get: async (path: string) => {
        calls.push(`GET ${path.split('?')[0]}`);
        if (path.startsWith('/organisation')) return answer({ data: { data: existing } });
        return answer({ data: [{ countryid: 'c1' }] });
      },
      post: async (path: string) => {
        calls.push(`POST ${path}`);
        return answer({ data: { organisationid: 'created-id' } });
      },
    } as never,
  };
}

test.describe('fixture organisation', () => {
  test('it is found by its code and never created again', async () => {
    const { api, calls } = fakeApi([{ organisationid: 'org-1', organisationcode: FIXTURE_ORGANISATION.code }]);
    expect(await fixtureOrganisationId(api, 'http://localhost:3101')).toBe('org-1');
    expect(calls.some((c) => c.startsWith('POST'))).toBe(false);
  });

  test('a lookalike code is not the fixture: it is created (on a local API)', async () => {
    const { api, calls } = fakeApi([{ organisationid: 'other', organisationcode: `${FIXTURE_ORGANISATION.code}x` }]);
    expect(await fixtureOrganisationId(api, 'http://localhost:3102')).toBe('created-id');
    expect(calls).toContain('POST /organisation');
  });

  test('on a host that is not local it is never created: it throws, having sent nothing', async () => {
    const { api, calls } = fakeApi([]);
    await expect(fixtureOrganisationId(api, 'https://uat.example.org')).rejects.toThrow(/only creates it on a local API/);
    expect(calls.some((c) => c.startsWith('POST'))).toBe(false);
  });

  test('a staff account goes in the fixture organisation, and a platform account in none', async () => {
    const { api } = fakeApi([{ organisationid: 'org-9', organisationcode: FIXTURE_ORGANISATION.code }]);
    // (cached per host: a new port keeps this independent of the tests above)
    expect(await organisationFor(api, [ROLE.teacher])).toEqual({ organisationid: 'org-9' });
    expect(await organisationFor(api, [ROLE.superadmin, ROLE.admin])).toEqual({});
  });
});
