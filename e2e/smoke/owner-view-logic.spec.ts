import { expect, test } from '@playwright/test';
import {
  ALL_ORGANISATIONS_LABEL,
  CHOOSE_ORGANISATION_NOTICE,
  NO_OWNER_LABEL,
  ORGANISATION_FILTER_KEY,
  filterRowsByOrganisation,
  organisationOf,
  ownerColumnVisible,
  ownerLabel,
  withOrganisationFilter,
} from '../../src/app/shared/owner/owner-view';

/**
 * The platform view's owner column (src/app/shared/owner/owner-view.ts), in Node: when it shows, what it
 * calls an organisation, and how the filter above a list is added to and taken from a list's filter. No browser, no API.
 */

const PLATFORM = { isplatform: true, organisationid: null };
const PLATFORM_ACTING = { isplatform: true, organisationid: 'org-a' };
const MEMBER = { isplatform: false, organisationid: 'org-a' };

test.describe('who sees the owner column and the filter', () => {
  test('a platform account that is not acting does', () => {
    expect(ownerColumnVisible(PLATFORM)).toBe(true);
  });
  test('a platform account acting in an organisation does not: every row is that organisation\'s', () => {
    expect(ownerColumnVisible(PLATFORM_ACTING)).toBe(false);
  });
  test('an organisation\'s own staff do not', () => {
    expect(ownerColumnVisible(MEMBER)).toBe(false);
  });
  test('an account with no scope at all does not', () => {
    expect(ownerColumnVisible({ isplatform: false, organisationid: null })).toBe(false);
  });
});

test.describe('the name of an owner', () => {
  const names = new Map([
    ['org-a', 'ក្រុមហ៊ុន ក'], // Khmer: the product is taught in it
    ['org-b', 'Second organisation'],
  ]);
  test('is the organisation\'s name, Khmer included, exactly as it is stored', () => {
    expect(ownerLabel('org-a', names)).toBe('ក្រុមហ៊ុន ក');
    expect(ownerLabel('org-b', names)).toBe('Second organisation');
  });
  test('falls back to the id when the organisation is not in the list', () => {
    expect(ownerLabel('org-gone', names)).toBe('org-gone');
  });
  test('says so for a row with no owner yet', () => {
    expect(ownerLabel(null, names)).toBe(NO_OWNER_LABEL);
    expect(ownerLabel(undefined, names)).toBe(NO_OWNER_LABEL);
    expect(ownerLabel('', names)).toBe(NO_OWNER_LABEL);
  });
});

test.describe('the filter above a list', () => {
  test('is added to a list\'s filter under the key central reads, keeping every other entry', () => {
    const before = [{ key: 'gradename', value: 'One' }];
    expect(withOrganisationFilter(before, 'org-a')).toEqual([
      { key: 'gradename', value: 'One' },
      { key: ORGANISATION_FILTER_KEY, value: 'org-a' },
    ]);
    expect(before).toEqual([{ key: 'gradename', value: 'One' }]); // the list it was given is not changed
  });
  test('central\'s key is organisationid', () => {
    expect(ORGANISATION_FILTER_KEY).toBe('organisationid');
  });
  test('replaces an earlier choice instead of adding a second', () => {
    const once = withOrganisationFilter([], 'org-a');
    expect(withOrganisationFilter(once, 'org-b')).toEqual([{ key: 'organisationid', value: 'org-b' }]);
  });
  test('"All" removes it and nothing else', () => {
    const narrowed = withOrganisationFilter([{ key: 'gradename', value: 'One' }], 'org-a');
    expect(withOrganisationFilter(narrowed, null)).toEqual([{ key: 'gradename', value: 'One' }]);
  });
  test('is read back from the list\'s filter (a filter restored from the address)', () => {
    expect(organisationOf([{ key: 'gradename', value: 'One' }, { key: 'organisationid', value: 'org-a' }])).toBe('org-a');
    expect(organisationOf([{ key: 'gradename', value: 'One' }])).toBeNull();
    expect(organisationOf([{ key: 'organisationid', value: '' }])).toBeNull();
    expect(organisationOf(undefined)).toBeNull();
  });
  test('the first choice reads "All organisations"', () => {
    expect(ALL_ORGANISATIONS_LABEL).toBe('All organisations');
  });
});

test.describe('a list the page holds whole (lessons, baselines)', () => {
  const rows = [
    { id: 1, org: 'org-a' },
    { id: 2, org: 'org-b' },
    { id: 3, org: 'org-a' },
    { id: 4, org: null },
  ];
  const owner = (r: { org: string | null }) => r.org;
  test('is narrowed to the rows of the organisation chosen', () => {
    expect(filterRowsByOrganisation(rows, owner, 'org-a').map((r) => r.id)).toEqual([1, 3]);
    expect(filterRowsByOrganisation(rows, owner, 'org-b').map((r) => r.id)).toEqual([2]);
  });
  test('is every row, owned or not, for "All"', () => {
    expect(filterRowsByOrganisation(rows, owner, null).map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });
  test('an organisation with no rows leaves nothing', () => {
    expect(filterRowsByOrganisation(rows, owner, 'org-none')).toEqual([]);
  });
});

test('the create controls give the hint the API\'s own refusal gives', () => {
  expect(CHOOSE_ORGANISATION_NOTICE).toContain('Choose an organisation to act in');
});
