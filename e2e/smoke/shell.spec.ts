import { APIRequestContext, Locator, Page, expect, test } from '@playwright/test';
import { ROLE, SUPERADMIN } from '../fixtures/accounts';
import { apiContext, apiLogin, jwtClaims, loginViaUi } from '../fixtures/auth';

/**
 * The navigation shell: floating nav panel, breadcrumb row, account menu.
 *
 * Two describe blocks, run in order. The first uses one superadmin login (the
 * JWT lives in sessionStorage) and is serial, because the collapse test changes
 * state that a reload must keep and the sign-out test has to run last: it
 * leaves the page on the login screen. The second signs in as role-limited
 * users. It creates them through the API, which logs the superadmin in again
 * and so evicts the first block's session: that is why it must come second.
 */

let page: Page;
let nav: Locator;

const COLLAPSED_KEY = 'edtech-admin-nav-collapsed';
const PANEL_WIDTH = 248;
const RAIL_WIDTH = 76;

test.describe('shell, signed in as superadmin', () => {
test.describe.configure({ mode: 'serial' });

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

  // Schools and Classes are different things and have different icons.
  const iconOf = (name: string) => nav.getByRole('link', { name, exact: true }).locator('path').first().getAttribute('d');
  expect(await iconOf('Classes')).not.toBe(await iconOf('Schools'));
});

test('the account chip shows the name and the sign-in email, not a role', async () => {
  await page.goto('/dashboard/index');
  const chip = nav.getByRole('button', { name: /superadmin/i });
  await expect(chip).toContainText(SUPERADMIN.username);
  // lmsuserrole is stamped as superadmin on every account, so it must not be shown.
  await expect(chip).not.toContainText(/\bSuperadmin\b/);
  await expect(chip.locator('.email')).toHaveAttribute('title', SUPERADMIN.username);
  // The name line ellipsizes when it is long: the full name is its tooltip.
  const name = chip.locator('.name');
  await expect(name).toHaveAttribute('title', (await name.textContent())!.trim());
});

test('the window scrolls and the nav panel stays in view', async () => {
  await page.goto('/question/index');
  await expect(page.locator('main tbody tr').first()).toBeVisible();
  const before = await nav.boundingBox();
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  const after = await nav.boundingBox();
  expect(Math.round(after!.y)).toBe(Math.round(before!.y));
  await page.evaluate(() => window.scrollTo(0, 0));
});

test('every link navigates and becomes the one current page', async () => {
  const top: Array<[string, RegExp]> = [
    ['Home', /\/dashboard\/index$/],
    ['Questions', /\/question\/index(\?|$)/],
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

  // Close the sub-list: its current child is out of sight, so the expander
  // itself becomes the one current item.
  const curricula = nav.getByRole('button', { name: 'Curricula', exact: true });
  await curricula.click();
  await expect(curricula).toHaveAttribute('aria-expanded', 'false');
  await expect(curricula).toHaveAttribute('aria-current', 'page');
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
});

test('the collapsed rail persists across a reload', async () => {
  await page.goto('/dashboard/index');
  await page.evaluate((key) => localStorage.removeItem(key), COLLAPSED_KEY);
  await page.reload();
  await expect.poll(panelWidth).toBe(PANEL_WIDTH);

  // Collapse to the rail. It is the same button in both states, so keyboard
  // focus stays on it (it used to drop to <body> when two buttons swapped).
  const toggle = page.getByRole('button', { name: 'Main menu' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect.poll(panelWidth).toBe(RAIL_WIDTH);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();

  // On the rail the names are still the accessible names, with a tooltip.
  await expect(nav.getByRole('link', { name: 'Questions', exact: true })).toHaveAttribute('title', 'Questions');

  // A reload keeps it.
  await page.reload();
  await expect.poll(panelWidth).toBe(RAIL_WIDTH);

  // Expand again, and a reload keeps that too.
  await page.getByRole('button', { name: 'Main menu' }).click();
  await expect.poll(panelWidth).toBe(PANEL_WIDTH);
  await expect(page.getByRole('button', { name: 'Main menu' })).toBeFocused();
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
    await expect(page.getByRole('heading', { level: 2, name: title, exact: true })).toBeVisible();
  }

  // Home already leads to Reach for this user, so the hub does not repeat it.
  await expect(section('Programme').getByRole('link', { name: 'Reach', exact: true })).toHaveCount(0);

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

test('Sign out ends the session and returns to the login page', async () => {
  await page.goto('/dashboard/index');
  const tokenKeys = () => page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('lms_')));
  expect(await tokenKeys(), 'signed in: the tokens are in session storage').not.toEqual([]);

  const chip = nav.getByRole('button', { name: /superadmin/i });
  await chip.click();
  // The menu holds Sign out and nothing else (the dead Profile item is gone).
  await expect(page.getByRole('menuitem')).toHaveText(['Sign out']);

  // Signing out also tells the server (it revokes the token).
  // (A short timeout, so a regression fails here, readably, and not as a 30s
  // "page closed" timeout at the end of the test.)
  const serverLogout = page.waitForResponse((r) => r.url().includes('/auth/logout'), { timeout: 5_000 });
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  expect((await serverLogout).ok(), 'the server revokes the token on sign out').toBeTruthy();

  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  // No tokens left behind...
  expect(await tokenKeys()).toEqual([]);
  // ...so a protected page is not reachable any more.
  await page.goto('/question/index');
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
});
});

test.describe('shell, signed in as a role-limited user', () => {
  test.describe.configure({ mode: 'serial' });

  const stamp = Date.now();
  const TEACHER = { username: `e2e-shell-teacher-${stamp}@example.com`, password: 'ShellTeacher_Pass1' };
  // The User role holds no permissions at all.
  const NOBODY = { username: `e2e-shell-nobody-${stamp}@example.com`, password: 'ShellNobody_Pass1' };

  let superadmin: APIRequestContext;
  const createdUserIds: string[] = [];

  async function makeUser(account: { username: string; password: string }, role: string): Promise<void> {
    const created = await superadmin.post('/user/create', {
      data: {
        lmsusername: account.username,
        lmsuserpasswordhash: account.password,
        lmsuserroles: [role],
        countryids: [],
        schoolids: [],
      },
    });
    expect(created.ok(), `could not create ${account.username}: ${created.status()}`).toBeTruthy();
    createdUserIds.push((await created.json()).data.lmsuserid);
  }

  // Sign-in is rate-limited; the shared fixtures wait it out when (and only when)
  // the API says 429, so nothing here sleeps on a schedule.
  test.beforeAll(async () => {
    superadmin = await apiContext(await apiLogin());
    await makeUser(TEACHER, ROLE.teacher);
    await makeUser(NOBODY, ROLE.user);
  });

  test.afterAll(async () => {
    // DELETE /user/:id disables the account rather than removing it (same as
    // role-grants.spec.ts), so these rows stay in lmsusers, uniquely named:
    //   DELETE FROM lmsusers WHERE lmsusername LIKE 'e2e-shell-%';
    for (const id of createdUserIds) {
      const res = await superadmin.delete(`/user/${id}`);
      if (!res.ok()) throw new Error(`failed to disable fixture user ${id}: HTTP ${res.status()}`);
    }
    await superadmin?.dispose();
  });

  // Written out here, not read from shell-nav.config.ts, so a change to the
  // menu's permissions cannot quietly rewrite what this test expects.
  const LINKS: Array<{ label: string; keys: string[]; parent?: string }> = [
    { label: 'Curriculum list', keys: ['view_curriculum'], parent: 'Curricula' },
    { label: 'Grades', keys: ['view_grade'], parent: 'Curricula' },
    { label: 'Levels', keys: ['view_level'], parent: 'Curricula' },
    { label: 'Lessons', keys: ['view_lesson'], parent: 'Curricula' },
    { label: 'Map', keys: ['view_map'], parent: 'Curricula' },
    { label: 'Questions', keys: ['view_question'] },
    { label: 'Media', keys: ['view_document'] },
    { label: 'Assessments', keys: ['view_baseline-endline'] },
    { label: 'Schools', keys: ['view_school'] },
    { label: 'Classes', keys: ['view_standard'] },
    { label: 'Learners', keys: ['view_student'] },
    { label: 'Teachers', keys: ['view_teacher'] },
    { label: 'Staff accounts', keys: ['view_user'], parent: 'Administration' },
    { label: 'Roles', keys: ['view_role'], parent: 'Administration' },
    { label: 'Subjects', keys: ['view_subject'], parent: 'Administration' },
    { label: 'Countries', keys: ['view_country'], parent: 'Administration' },
    { label: 'Question tags', keys: ['view_questiontag'], parent: 'Administration' },
    { label: 'Media tags', keys: ['view_documenttag'], parent: 'Administration' },
    { label: 'Feedback', keys: ['view_feedback'], parent: 'Administration' },
  ];

  test('a Teacher sees exactly the items their permissions allow', async ({ browser }) => {
    const p = await browser.newPage();
    try {
      await loginViaUi(p, TEACHER.username, TEACHER.password);
      const side = p.locator('nav[aria-label="Main"]');
      // The token the app holds is the source of truth for what this user may see.
      const token = await p.evaluate(() => {
        const g = (k: string) => sessionStorage.getItem(k);
        return `${g('lms_access_alg')}.${g('lms_access_payload')}.${g('lms_access_hash')}`;
      });
      const held = new Set(jwtClaims(token).permissions as string[]);

      // Open both expanders (when present) so every child is in the DOM.
      for (const parent of ['Curricula', 'Administration']) {
        const button = side.getByRole('button', { name: parent, exact: true });
        if ((await button.count()) && (await button.getAttribute('aria-expanded')) !== 'true') await button.click();
      }

      let shown = 0;
      let hidden = 0;
      for (const { label, keys } of LINKS) {
        const expected = keys.some((k) => held.has(k));
        const link = side.getByRole('link', { name: label, exact: true });
        if (expected) {
          await expect(link, `${label} is permitted`).toBeVisible();
          shown++;
        } else {
          await expect(link, `${label} is not permitted`).toHaveCount(0);
          hidden++;
        }
      }
      // Guard the guard: this account must exercise both branches.
      expect(shown, 'the Teacher should be allowed some items').toBeGreaterThan(0);
      expect(hidden, 'the Teacher should be denied some items').toBeGreaterThan(0);
    } finally {
      await p.close();
    }
  });

  test('with no permissions, every group disappears with its label and Home leads to the default page', async ({
    browser,
  }) => {
    const p = await browser.newPage();
    try {
      await loginViaUi(p, NOBODY.username, NOBODY.password);
      await expect(p).toHaveURL(/\/dashboard\/default$/);
      const side = p.locator('nav[aria-label="Main"]');
      await expect(side).toBeVisible();

      // Home is always there, and without the Reach permission it goes to the default page.
      const home = side.getByRole('link', { name: 'Home', exact: true });
      await expect(home).toHaveAttribute('href', '/dashboard/default');
      await expect(home).toHaveAttribute('aria-current', 'page');

      // Nothing else: no group, no group label, no expander, no other link.
      await expect(side.getByRole('group')).toHaveCount(0);
      for (const label of ['Content', 'People', 'Reports and settings']) {
        await expect(side.getByText(label, { exact: true })).toHaveCount(0);
      }
      await expect(side.getByRole('button', { name: 'Curricula', exact: true })).toHaveCount(0);
      await expect(side.getByRole('button', { name: 'Administration', exact: true })).toHaveCount(0);
      await expect(side.getByRole('link')).toHaveCount(1);
    } finally {
      await p.close();
    }
  });

  test('Sign out still works, quietly, when the server cannot be reached', async ({ browser }) => {
    const p = await browser.newPage();
    try {
      await loginViaUi(p, NOBODY.username, NOBODY.password);
      const tokenKeys = () => p.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('lms_')));
      expect(await tokenKeys(), 'signed in: the tokens are in session storage').not.toEqual([]);

      // The API is unreachable for the logout request only.
      await p.route('**/auth/logout', (route) => route.abort('connectionrefused'));
      const failed = p.waitForEvent('requestfailed', {
        predicate: (r) => r.url().includes('/auth/logout'),
        timeout: 5_000,
      });
      await p.locator('nav[aria-label="Main"]').getByRole('button', { name: /e2e-shell-nobody/i }).click();
      await p.getByRole('menuitem', { name: 'Sign out' }).click();
      await failed;

      // The session is cleared and the user is on the sign-in page...
      await expect(p).toHaveURL(/\/auth\/login/);
      await expect(p.getByLabel('Email', { exact: true })).toBeVisible();
      expect(await tokenKeys(), 'no tokens left behind').toEqual([]);
      // ...without an error toast: the failure of a request the user cannot act
      // on is not news. (Give a toast the time it would need to appear.)
      await p.waitForTimeout(750);
      await expect(p.locator('.ant-notification-notice')).toHaveCount(0);
    } finally {
      await p.close();
    }
  });
});
