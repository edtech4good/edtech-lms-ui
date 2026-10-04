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
