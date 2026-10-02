import { APIRequestContext, expect } from '@playwright/test';
import { ROLE } from './accounts';
import { API_URL } from './env';
import { isLocalHost } from './local-fixture-user';

/**
 * The one organisation the suite's staff accounts belong to. Every staff account
 * that is not a platform account must be in an organisation, so a helper that makes
 * one needs an id.
 *
 * It is FOUND, never recreated and never deleted: an organisation code can never be
 * reused (not even after a delete), so a second create of this code would fail, and
 * deleting it would strand the next run. It is created once, on a local API only: a
 * live organisation is a standing row, and a real server's list is not ours to fill.
 */
export const FIXTURE_ORGANISATION = {
  code: 'e2efixture',
  name: 'E2E Fixture Organisation',
  shortname: 'EFO',
};

/**
 * A second fixed organisation, named in Khmer, for tests that move an account or
 * choose between organisations. Found or created the same way, and never deleted:
 * an organisation that has had a staff account (disabled ones too) cannot be deleted.
 */
export const SECOND_FIXTURE_ORGANISATION = {
  code: 'e2efixturekm',
  name: 'ក្រុមហ៊ុនគំរូ E2E',
  shortname: 'កគ',
};

type Fixture = typeof FIXTURE_ORGANISATION;

const known = new Map<string, Promise<string>>();

/** A fixture organisation's id: found by its code, else created (local API only). */
export function fixtureOrganisationId(
  superadmin: APIRequestContext,
  apiUrl: string = API_URL,
  fixture: Fixture = FIXTURE_ORGANISATION,
): Promise<string> {
  const key = `${apiUrl} ${fixture.code}`;
  let found = known.get(key);
  if (!found) {
    found = findOrCreate(superadmin, apiUrl, fixture);
    known.set(key, found);
    // A failed attempt is not cached: the next call tries again.
    found.catch(() => known.delete(key));
  }
  return found;
}

async function findOrCreate(superadmin: APIRequestContext, apiUrl: string, fixture: Fixture): Promise<string> {
  const list = await superadmin.get(`/organisation?pagesize=200&organisationname=${encodeURIComponent(fixture.name)}`);
  expect(list.ok(), `could not list organisations: HTTP ${list.status()}`).toBeTruthy();
  const rows: Array<{ organisationid: string; organisationcode: string }> = (await list.json()).data.data;
  const existing = rows.find((o) => o.organisationcode === fixture.code);
  if (existing) return existing.organisationid;

  if (!isLocalHost(apiUrl)) {
    throw new Error(
      `the fixture organisation "${fixture.code}" does not exist on ${apiUrl}, and this suite only creates it on a local API`,
    );
  }
  const country = (await (await superadmin.get('/country/all?country=')).json()).data[0]?.countryid;
  expect(country, 'the local database has a country to link the fixture organisation to').toBeTruthy();
  const created = await superadmin.post('/organisation', {
    data: {
      organisationname: fixture.name,
      organisationcode: fixture.code,
      organisationshortname: fixture.shortname,
      organisationpreset: 'company',
      uitheme: 'corporate',
      countryids: [country],
    },
  });
  expect(
    created.ok(),
    `could not create the fixture organisation (HTTP ${created.status()}): its code can never be reused, so if it was deleted it cannot be made again`,
  ).toBeTruthy();
  return (await created.json()).data.organisationid;
}

/**
 * The request fields that put a new staff account in the right organisation: the
 * fixture organisation, or nothing for a platform account (one that holds Super Admin).
 */
export async function organisationFor(
  superadmin: APIRequestContext,
  roles: readonly string[],
  apiUrl: string = API_URL,
): Promise<{ organisationid?: string }> {
  if (roles.includes(ROLE.superadmin)) return {};
  return { organisationid: await fixtureOrganisationId(superadmin, apiUrl) };
}
