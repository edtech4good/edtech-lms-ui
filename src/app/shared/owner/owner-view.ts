// Pure parts of the platform view's owner column (no Angular), so plain-Node specs can import them.
import { needsOrganisation } from '../../modules/shell/org-context';

/** The filter key every owned list accepts (central: the rows of one organisation). */
export const ORGANISATION_FILTER_KEY = 'organisationid';

/** The first option of the organisation filter: no narrowing. */
export const ALL_ORGANISATIONS_LABEL = 'All organisations';

/** What a row with no owner yet shows (only the platform sees such a row). */
export const NO_OWNER_LABEL = 'No organisation yet';

/** The text of the disabled create controls' hint (central says the same when it refuses a create). */
export { CHOOSE_ORGANISATION_NOTICE } from '../../modules/shell/org-context';

/**
 * Does the list show the owning organisation? Only in the platform view (a platform account that is not acting). In an
 * organisation every row is that organisation's, so a column naming it, or a filter between organisations, is noise.
 */
export function ownerColumnVisible(claims: { isplatform: boolean; organisationid: string | null }): boolean {
  return needsOrganisation(claims);
}

/** The name of an owner, else its id when the organisation is not in the list, else the "no owner" wording. */
export function ownerLabel(id: string | null | undefined, names: ReadonlyMap<string, string>): string {
  if (id === null || id === undefined || id === '') return NO_OWNER_LABEL;
  return names.get(id) ?? id;
}

/** A list's filter with the organisation filter set (`null`: removed), every other entry kept as it was. */
export function withOrganisationFilter<T extends { key?: string; value?: unknown }>(
  filter: readonly T[],
  organisationid: string | null,
): T[] {
  const others = filter.filter((f) => f.key !== ORGANISATION_FILTER_KEY);
  return organisationid ? [...others, { key: ORGANISATION_FILTER_KEY, value: organisationid } as T] : others;
}

/** The organisation a list's filter is narrowed to, or `null`. */
export function organisationOf(filter: readonly { key?: string; value?: unknown }[] | null | undefined): string | null {
  const found = (filter ?? []).find((f) => f.key === ORGANISATION_FILTER_KEY);
  return typeof found?.value === 'string' && found.value !== '' ? found.value : null;
}

/** For a list the page holds whole (no server paging): the rows of one organisation (`null`: all of them). */
export function filterRowsByOrganisation<T>(
  rows: readonly T[],
  ownerOf: (row: T) => string | null | undefined,
  organisationid: string | null,
): T[] {
  return organisationid ? rows.filter((r) => ownerOf(r) === organisationid) : [...rows];
}
