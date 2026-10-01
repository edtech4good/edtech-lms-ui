import { Locator, Page, expect, test } from '@playwright/test';
import { loginViaUi } from '../fixtures/auth';

/**
 * The navigation shell: floating nav panel, breadcrumb row, account menu.
 *
 * One login for the whole file (the JWT lives in sessionStorage). Serial,
 * because the collapse test changes state that a reload must keep, and the
 * sign-out test has to run last: it leaves the page on the login screen.
 */
test.describe.configure({ mode: 'serial' });

let page: Page;
let nav: Locator;

const COLLAPSED_KEY = 'edtech-admin-nav-collapsed';
const PANEL_WIDTH = 248;
const RAIL_WIDTH = 76;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await loginViaUi(page);
  nav = page.locator('nav[aria-label="Main"]');
});

test.afterAll(async () => {
  await page?.close();
});

/** The panel's rendered width, once the 280ms width animation has settled. */
async function panelWidth(): Promise<number> {
  const box = await nav.boundingBox();
  return Math.round(box?.width ?? -1);
}

/** Open an expander (Curricula / Administration) if it is closed. */
async function ensureOpen(name: string): Promise<void> {
  const expander = nav.getByRole('button', { name, exact: true });
  if ((await expander.getAttribute('aria-expanded')) !== 'true') {
    await expander.click();
  }
  await expect(expander).toHaveAttribute('aria-expanded', 'true');
}

test('the permitted groups render', async () => {
  await page.goto('/dashboard/index');
  await expect(nav).toBeVisible();

  // Home sits above the groups and is always there.
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).toBeVisible();

  // The superadmin holds every permission, so all of the labelled groups show
  // (a group with nothing visible is hidden along with its label).
  for (const label of ['Content', 'People', 'Reports and settings']) {
    await expect(nav.getByRole('group', { name: label, exact: true })).toBeVisible();
  }
  await expect(nav.getByRole('group')).toHaveCount(3);

  // Administration is the fifth group: an expander with no label above it.
  await expect(nav.getByRole('button', { name: 'Administration', exact: true })).toBeVisible();
  // ...and the old header bar and dark sider are gone.
  await expect(page.locator('nz-sider, nz-header')).toHaveCount(0);
});

test('every link navigates and becomes the one current page', async () => {
  const top: Array<[string, RegExp]> = [
    ['Home', /\/dashboard\/index$/],
    ['Questions', /\/question\/index/],
    ['Media', /\/document\/index$/],
    ['Assessments', /\/baseline-curriculum\/index$/],
    ['Schools', /\/school\/index$/],
    ['Classes', /\/standard\/index$/],
    ['Learners', /\/student\/index$/],
    ['Teachers', /\/teacher\/index$/],
    ['Reports', /\/report$/],
  ];
  const sub: Array<[string, string, RegExp]> = [
    ['Curricula', 'Curriculum list', /\/curriculum\/index$/],
    ['Curricula', 'Grades', /\/grade\/index$/],
    ['Curricula', 'Levels', /\/level\/index$/],
    ['Curricula', 'Lessons', /\/lesson\/index$/],
    ['Curricula', 'Map', /\/map\/index$/],
    ['Administration', 'Staff accounts', /\/user\/index$/],
    ['Administration', 'Roles', /\/role-perm\/index$/],
    ['Administration', 'Subjects', /\/subject\/index$/],
    ['Administration', 'Countries', /\/country\/index$/],
    ['Administration', 'Question tags', /\/questiontag\/index$/],
    ['Administration', 'Media tags', /\/documenttag\/index$/],
    ['Administration', 'Feedback', /\/feedback\/index$/],
  ];

  // Start somewhere neutral so the first click is a real navigation.
  await page.goto('/report');

  for (const [name, url] of top) {
    const link = nav.getByRole('link', { name, exact: true });
    await link.click();
    await expect(page, `${name} navigates`).toHaveURL(url);
    await expect(link, `${name} is current`).toHaveAttribute('aria-current', 'page');
    // Exactly one current item in the whole panel.
    await expect(nav.locator('[aria-current="page"]'), `${name} is the only current item`).toHaveCount(1);
  }

  for (const [parent, name, url] of sub) {
    await ensureOpen(parent);
    const link = nav.getByRole('link', { name, exact: true });
    await link.click();
    await expect(page, `${name} navigates`).toHaveURL(url);
    await expect(link, `${name} is current`).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current="page"]'), `${name} is the only current item`).toHaveCount(1);
    // Opening a page under an expander keeps its sub-list open.
    await expect(nav.getByRole('button', { name: parent, exact: true })).toHaveAttribute('aria-expanded', 'true');
  }
});

test('a child page keeps its parent active and shows the breadcrumb', async () => {
  await page.goto('/lesson/index');
  const crumbs = page.locator('nav[aria-label="Breadcrumb"] li');
  await expect(crumbs).toHaveText(['Content', 'Lessons']);

  // The demo seed has lessons; open the first one's Quiz page.
  await page.locator('main a[href*="/lesson/quiz/"]').first().click();
  await expect(page).toHaveURL(/\/lesson\/quiz\//);

  // Still "Lessons", the only current item, and Curricula stays open around it.
  await expect(nav.locator('[aria-current="page"]')).toHaveText('Lessons');
  await expect(nav.getByRole('button', { name: 'Curricula', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );

  // Content > Lessons > Quiz; the middle crumb links back to the list.
  await expect(crumbs).toHaveText(['Content', 'Lessons', 'Quiz']);
  await expect(page.locator('nav[aria-label="Breadcrumb"] a')).toHaveAttribute('href', '/lesson/index');
});

test('the collapsed rail persists across a reload', async () => {
  await page.goto('/dashboard/index');
  await page.evaluate((key) => localStorage.removeItem(key), COLLAPSED_KEY);
  await page.reload();
  await expect.poll(panelWidth).toBe(PANEL_WIDTH);

  // Collapse to the rail.
  await page.getByRole('button', { name: 'Main menu' }).click();
  await expect.poll(panelWidth).toBe(RAIL_WIDTH);
  await expect(page.getByRole('button', { name: 'Main menu' })).toHaveAttribute('aria-expanded', 'false');

  // On the rail the names are still the accessible names, with a tooltip.
  await expect(nav.getByRole('link', { name: 'Questions', exact: true })).toHaveAttribute('title', 'Questions');

  // A reload keeps it.
  await page.reload();
  await expect.poll(panelWidth).toBe(RAIL_WIDTH);

  // Expand again, and a reload keeps that too.
  await page.getByRole('button', { name: 'Main menu' }).click();
  await expect.poll(panelWidth).toBe(PANEL_WIDTH);
  await page.reload();
  await expect.poll(panelWidth).toBe(PANEL_WIDTH);
});

test('the panel starts as the rail on a narrow viewport', async () => {
  await page.setViewportSize({ width: 1000, height: 800 });
  try {
    await page.evaluate((key) => localStorage.removeItem(key), COLLAPSED_KEY);
    await page.reload();
    await expect.poll(panelWidth).toBe(RAIL_WIDTH);
  } finally {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate((key) => localStorage.removeItem(key), COLLAPSED_KEY);
    await page.reload();
    await expect.poll(panelWidth).toBe(PANEL_WIDTH);
  }
});

test('Skip to content is the first stop and moves focus to the page', async () => {
  await page.goto('/dashboard/index');
  await expect(nav).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveText('Skip to content');
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  // It must not have navigated to the app root through <base href="/">.
  await expect(page).toHaveURL(/\/dashboard\/index$/);
});

test('the Reports hub lists its sections', async () => {
  await page.goto('/report');
  const section = (title: string) => page.locator('nz-card', { hasText: title });

  for (const title of ['Programme', 'Learners, offline schools', 'Learners, online schools', 'Sync record']) {
    await expect(page.locator('nz-card .ant-card-head-title', { hasText: title })).toBeVisible();
  }

  await expect(section('Programme').getByRole('link', { name: 'Reach by school' })).toHaveAttribute(
    'href',
    '/dashboard/school',
  );
  await expect(section('Learners, offline schools').getByRole('link', { name: 'Quiz scores' })).toHaveAttribute(
    'href',
    '/report/student-completed-quiz',
  );
  // The online links carry online=true, exactly as the old sidebar built them.
  await expect(section('Learners, online schools').getByRole('link', { name: 'Quiz scores' })).toHaveAttribute(
    'href',
    '/report/student-completed-quiz/online?online=true',
  );
  await expect(section('Sync record').getByRole('link', { name: 'Sync record' })).toHaveAttribute(
    'href',
    '/report/sync-record',
  );
});

test('Sign out returns to the login page', async () => {
  await page.goto('/dashboard/index');
  const chip = nav.getByRole('button', { name: /superadmin/i });
  await chip.click();
  // The menu holds Sign out and nothing else (the dead Profile item is gone).
  await expect(page.getByRole('menuitem')).toHaveText(['Sign out']);
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.locator('input[formControlName="lmsusername"]')).toBeVisible();
});
