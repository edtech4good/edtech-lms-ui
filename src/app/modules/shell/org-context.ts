// Pure parts of the organisation context (no Angular), so plain-Node specs can import them.

export const PLATFORM_RETURN_NOTICE = "You're back to the platform view.";

/**
 * Pages that make no sense after the context changes: a record opened by its id
 * (an edit or view page), which may not exist, or not be visible, in the other
 * context. Lists, create forms and the dashboards just load again.
 */
export function pageMakesSenseInAnyContext(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  const segments = path.split('/').filter(Boolean);
  return !segments.some(
    (s, i) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ||
      (i > 0 && ['update', 'view', 'edit', 'details', 'stats'].includes(segments[i - 1])),
  );
}

/**
 * Should a token change say "You're back to the platform view."? Only when the change was not
 * the switch the person asked for (`expectedSwitch` is defined then) and a platform account
 * has lost the organisation it was acting in: a refresh did that, not them.
 */
export function shouldNotifyPlatformReturn(
  before: { organisationid: string | null },
  after: { organisationid: string | null; isplatform: boolean },
  expectedSwitch: string | null | undefined,
): boolean {
  if (expectedSwitch !== undefined) return false;
  return before.organisationid !== null && after.organisationid === null && after.isplatform;
}

/** What the API says when content is created with no organisation chosen (central's own sentence, shown before it is asked). */
export const CHOOSE_ORGANISATION_NOTICE = 'Choose an organisation to act in before you create content. Use the organisation switcher, then try again.';

/**
 * Is this the platform view, with no organisation chosen? Every create of content is refused there, before anything
 * else is looked at, so the controls that create content say so up front.
 */
export function needsOrganisation(claims: { isplatform: boolean; organisationid: string | null }): boolean {
  return claims.isplatform && claims.organisationid === null;
}
