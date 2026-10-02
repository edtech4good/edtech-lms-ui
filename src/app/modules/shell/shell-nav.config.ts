import { ShellIconName } from './shell-icons';

/**
 * The shell's menu: structure, routes, permissions and icons in one place.
 * Design: docs/design/admin/handoff-v2 (README.md "Shell", AdminNav.dc.html).
 */

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

const sidebarPermCache = new Map<string, string[]>();

/**
 * ngx-permissions treats arrays as OR. The LMS JWT includes the synthetic permission
 * `superadmin` for superadmin@superadmin.com (see central API). Only User / Role menu
 * entries listed `superadmin` explicitly, so the rest of the sidebar stayed hidden when
 * the token did not yet carry every `view_*` name (e.g. report/dashboard-only keys).
 *
 * The returned array has to keep a stable identity across change detection. Angular
 * memoizes array literals in a template through pureFunction, so the `['view_x']` this
 * replaced was allocated once. A method call gets no such treatment: it runs on every
 * cycle, so returning a fresh array made ngxPermissionsOnly see a changed input every
 * cycle, re-validate, markForCheck, and schedule another one. That loop never settles,
 * and because the validation is async it hangs the sidebar without ever raising
 * ExpressionChangedAfterItHasBeenCheckedError.
 *
 * (Now a module-level function: every menu entry below calls it once, when this file
 * loads, and the templates read the resulting arrays as plain properties. Do not
 * replace those properties with getters or template calls that build arrays.)
 */
export function sidebarPerm(...keys: string[]): string[] {
  const cacheKey = keys.join('|');
  let perms = sidebarPermCache.get(cacheKey);
  if (!perms) {
    perms = [...keys, 'superadmin'];
    sidebarPermCache.set(cacheKey, perms);
  }
  return perms;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Icon tile colours. Ink / tint pairs are the design's "group colours". */
export type ShellTone = 'home' | 'content' | 'people' | 'reports' | 'admin';

export interface ShellNavLink {
  key: string;
  label: string;
  route: string;
  queryParams?: Record<string, string>;
  /**
   * URL path prefixes that make this item the active one. A prefix matches a whole
   * path segment: '/document' matches '/document/index' but not '/documenttag/index'.
   */
  match: string[];
  /** Permission names, already including `superadmin`. A stable array (see sidebarPerm). */
  permissions: string[];
}

/** A top-level entry that is a plain link. */
export interface ShellNavItem extends ShellNavLink {
  icon: ShellIconName;
}

/** A top-level entry that expands in place to show `children`. */
export interface ShellNavExpander {
  key: string;
  label: string;
  icon: ShellIconName;
  children: ShellNavLink[];
  /** Any child's permission shows the expander. */
  permissions: string[];
}

export type ShellNavEntry = ShellNavItem | ShellNavExpander;

export function isExpander(entry: ShellNavEntry): entry is ShellNavExpander {
  return (entry as ShellNavExpander).children !== undefined;
}

export interface ShellNavGroup {
  key: string;
  /** Shown above the group in the full panel. Groups without one still render. */
  label?: string;
  tone: ShellTone;
  entries: ShellNavEntry[];
  /** Any entry's permission shows the group; with none visible the group, and its label, is hidden. */
  permissions: string[];
  /** Rail: draw a divider above this group. */
  railDivider: boolean;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const link = (
  key: string,
  label: string,
  route: string,
  perms: string[],
  extra: Partial<Pick<ShellNavLink, 'match' | 'queryParams'>> = {},
): ShellNavLink => ({
  key,
  label,
  route,
  match: extra.match ?? [route.replace(/\/index$/, '')],
  queryParams: extra.queryParams,
  permissions: sidebarPerm(...perms),
});

const item = (icon: ShellIconName, l: ShellNavLink): ShellNavItem => ({ ...l, icon });

const expander = (
  key: string,
  label: string,
  icon: ShellIconName,
  children: ShellNavLink[],
): ShellNavExpander => ({
  key,
  label,
  icon,
  children,
  permissions: sidebarPerm(...children.flatMap((c) => c.permissions.filter((p) => p !== 'superadmin'))),
});

const group = (
  key: string,
  label: string | undefined,
  tone: ShellTone,
  entries: ShellNavEntry[],
  railDivider = true,
): ShellNavGroup => ({
  key,
  label,
  tone,
  entries,
  railDivider,
  permissions: sidebarPerm(
    ...entries.flatMap((e) =>
      e.permissions.filter((p) => p !== 'superadmin'),
    ),
  ),
});

// ---------------------------------------------------------------------------
// Reports hub (the page at /report) and the permissions behind the Reports item
// ---------------------------------------------------------------------------

export interface ReportHubLink {
  label: string;
  route: string;
  queryParams?: Record<string, string>;
  /** Already includes `superadmin`. */
  permissions: string[];
}

export interface ReportHubSection {
  key: string;
  title: string;
  help: string;
  links: ReportHubLink[];
  permissions: string[];
}

const hubLink = (
  label: string,
  route: string,
  perms: string[],
  queryParams?: Record<string, string>,
): ReportHubLink => ({ label, route, queryParams, permissions: sidebarPerm(...perms) });

const hubSection = (
  key: string,
  title: string,
  help: string,
  links: ReportHubLink[],
): ReportHubSection => ({
  key,
  title,
  help,
  links,
  permissions: sidebarPerm(...links.flatMap((l) => l.permissions.filter((p) => p !== 'superadmin'))),
});

const ONLINE = { online: 'true' };

export const REPORT_HUB: ReportHubSection[] = [
  hubSection(
    'programme',
    'Programme',
    'Programme-wide dashboards: how far the app reaches, how it is used, fees and downtime.',
    [
      hubLink('Reach', '/dashboard/index', ['view_plus_reach']),
      hubLink('Reach by school', '/dashboard/school', ['view_reach_school']),
      hubLink('Impact', '/dashboard/app-usage', ['view_impact']),
      hubLink('Fees collection', '/dashboard/school-contribute', ['view_fees_collection']),
      hubLink('Tech downtime', '/dashboard/tech-downtime', ['view_tech_downtime']),
    ],
  ),
  hubSection(
    'offline',
    'Learners, offline schools',
    'Results for learners in schools that use the app offline.',
    [
      hubLink('Quiz scores', '/report/student-completed-quiz', ['view_offline_quiz_score', 'view_class_quiz_score']),
      hubLink('Current level', '/report/student-last-completed-quiz', ['view_current_level']),
      hubLink('Active status', '/report/student-activity', ['view_active_status']),
      hubLink('Level quiz', '/report/student-level-quiz', ['view_student_level_quiz', 'view_class_level_quiz']),
    ],
  ),
  hubSection(
    'online',
    'Learners, online schools',
    'The same reports for learners in schools that study online.',
    [
      hubLink('Quiz scores', '/report/student-completed-quiz/online', ['view_online_quiz_score', 'view_online_class_quiz_score'], ONLINE),
      hubLink('Current level', '/report/student-last-completed-quiz/online', ['view_online_current_level'], ONLINE),
      hubLink('Active status', '/report/student-activity/online', ['view_online_active_status'], ONLINE),
      hubLink('Level quiz', '/report/student-level-quiz/online', ['view_online_student_level_quiz', 'view_online_class_level_quiz'], ONLINE),
    ],
  ),
  hubSection('sync', 'Sync record', 'When schools last synced their data to the server.', [
    hubLink('Sync record', '/report/sync-record', ['view_sync_record']),
  ]),
];

// ---------------------------------------------------------------------------
// The menu
// ---------------------------------------------------------------------------

/** Home goes to the Reach dashboard when the user may see it, else to the default page. */
export const HOME_ROUTE = '/dashboard/index';
export const HOME_FALLBACK_ROUTE = '/dashboard/default';
export const HOME_PERMISSIONS = sidebarPerm('view_plus_reach');

/** Home sits above the groups, is always shown, and is never matched by prefix. */
export const SHELL_HOME: ShellNavItem = {
  key: 'home',
  label: 'Home',
  icon: 'home',
  route: HOME_ROUTE,
  // Home is matched by its two exact routes (see resolveActive), never by prefix.
  match: [],
  permissions: HOME_PERMISSIONS,
};

const reportsKeys = REPORT_HUB.flatMap((s) => s.permissions.filter((p) => p !== 'superadmin'));

/**
 * The Platform group's only permission. Unlike every other entry it is NOT widened
 * with the synthetic `superadmin` permission (sidebarPerm): the Organisations
 * routes are platform-only on the API and need view_organisation itself, so the
 * item is for the holders of that permission and nobody else. A stable array, for
 * the reason given at sidebarPerm.
 */
const ORGANISATION_PERMISSIONS = ['view_organisation'];

export const SHELL_GROUPS: ShellNavGroup[] = [
  {
    key: 'platform',
    label: 'Platform',
    tone: 'admin',
    railDivider: true,
    permissions: ORGANISATION_PERMISSIONS,
    entries: [
      {
        key: 'organisation',
        label: 'Organisations',
        icon: 'organisations',
        route: '/organisation',
        match: ['/organisation'],
        permissions: ORGANISATION_PERMISSIONS,
      },
    ],
  },
  group('content', 'Content', 'content', [
    // TEMPORARY: the Curricula workspace will replace these five screens with one
    // entry. Until then Curricula expands in place, like Administration.
    expander('curricula', 'Curricula', 'curricula', [
      link('curriculum', 'Curriculum list', '/curriculum/index', ['view_curriculum']),
      link('grade', 'Grades', '/grade/index', ['view_grade']),
      link('level', 'Levels', '/level/index', ['view_level']),
      link('lesson', 'Lessons', '/lesson/index', ['view_lesson']),
      link('map', 'Map', '/map/index', ['view_map']),
    ]),
    item('questions', link('question', 'Questions', '/question/index', ['view_question'])),
    item('media', link('document', 'Media', '/document/index', ['view_document'])),
    item(
      'assessments',
      link('assessments', 'Assessments', '/baseline-curriculum/index', ['view_baseline-endline'], {
        match: ['/baseline-curriculum'],
      }),
    ),
  ]),
  group('people', 'People', 'people', [
    item('schools', link('school', 'Schools', '/school/index', ['view_school'])),
    item('classes', link('standard', 'Classes', '/standard/index', ['view_standard'])),
    item('learners', link('student', 'Learners', '/student/index', ['view_student'])),
    item('teachers', link('teacher', 'Teachers', '/teacher/index', ['view_teacher'])),
  ]),
  group('reports', 'Reports and settings', 'reports', [
    item(
      'reports',
      {
        key: 'reports',
        label: 'Reports',
        route: '/report',
        // The dashboards live under /dashboard; Home claims /dashboard/index (or
        // /dashboard/default) first, so Reports gets the rest.
        match: ['/report', '/dashboard'],
        permissions: sidebarPerm(...reportsKeys),
      },
    ),
  ]),
  group(
    'administration',
    undefined,
    'admin',
    [
      expander('administration', 'Administration', 'administration', [
        link('user', 'Staff accounts', '/user/index', ['view_user']),
        link('role', 'Roles', '/role-perm/index', ['view_role']),
        link('subject', 'Subjects', '/subject/index', ['view_subject']),
        link('country', 'Countries', '/country/index', ['view_country']),
        link('questiontag', 'Question tags', '/questiontag/index', ['view_questiontag']),
        link('documenttag', 'Media tags', '/documenttag/index', ['view_documenttag']),
        link('feedback', 'Feedback', '/feedback/index', ['view_feedback']),
      ]),
    ],
    false,
  ),
];

// ---------------------------------------------------------------------------
// Matching a URL to the active item
// ---------------------------------------------------------------------------

export interface ShellActive {
  link: ShellNavLink;
  /** The expander the link sits under, if any. */
  parent?: ShellNavExpander;
  /** Undefined for Home, which sits above the groups. */
  group?: ShellNavGroup;
}

/** Path part of a URL: no query string, no fragment, no trailing slash. */
export function pathOf(url: string): string {
  const path = url.split(/[?#]/)[0];
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

function prefixMatches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + '/');
}

/**
 * The one item that is active for `url`.
 * Both home screens (/dashboard/index and /dashboard/default) are Home; every
 * other dashboard URL belongs to Reports. Elsewhere the longest matching prefix
 * wins, so child pages highlight their parent.
 */
export function resolveActive(url: string): ShellActive | null {
  const path = pathOf(url);
  if (path === HOME_ROUTE || path === HOME_FALLBACK_ROUTE) {
    return { link: SHELL_HOME };
  }
  let best: { active: ShellActive; len: number } | null = null;
  for (const g of SHELL_GROUPS) {
    for (const entry of g.entries) {
      const links = isExpander(entry) ? entry.children : [entry];
      for (const l of links) {
        for (const prefix of l.match) {
          if (prefixMatches(path, prefix) && (!best || prefix.length > best.len)) {
            best = {
              active: { link: l, parent: isExpander(entry) ? entry : undefined, group: g },
              len: prefix.length,
            };
          }
        }
      }
    }
  }
  return best?.active ?? null;
}
