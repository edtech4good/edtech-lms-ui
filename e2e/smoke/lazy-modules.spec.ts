import { Page, expect, test } from '@playwright/test';
import { loginViaUi } from '../fixtures/auth';

/**
 * Every lazy route in common-routing.module.ts loads.
 *
 * This is the highest-value check in the suite for the Angular ladder. A lazy
 * module that fails to load after an upgrade rung throws in the console and
 * paints an empty shell — the app looks alive, the route is simply blank. That
 * is invisible to a human clicking around quickly and invisible to the 64
 * scaffolded unit specs.
 */
const LAZY_ROUTES = [
  'baseline-curriculum',
  'dashboard',
  'documenttag',
  'questiontag',
  'subject',
  'curriculum',
  'grade',
  'level',
  'map',
  'lesson',
  'document',
  'question',
  'student',
  'teacher',
  'school',
  'standard',
  'country',
  'role-perm',
  'user',
  'feedback',
  'report',
] as const;

test.describe.configure({ mode: 'serial' });

let page: Page;
const consoleErrors: string[] = [];

test.beforeAll(async ({ browser }) => {
  // One login for the whole file: the JWT lives in sessionStorage, so it
  // survives navigation within a page but not a new context.
  page = await browser.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  await loginViaUi(page);
});

test.afterAll(async () => {
  await page?.close();
});

for (const route of LAZY_ROUTES) {
  test(`${route} loads`, async () => {
    consoleErrors.length = 0;
    await page.goto(`/${route}`);

    // Not bounced to login.
    await expect(page).not.toHaveURL(/\/auth/);

    // The chunk actually mounted something. router-outlet is always present;
    // a sibling element means a component rendered.
    await expect(page.locator('router-outlet + *').first()).toBeVisible({
      timeout: 15_000,
    });

    // ...but "something" is not enough. app-routing has a catch-all
    // `{ path: '**', component: PageNotFoundComponent }` that renders in place
    // without changing the URL, so a route that does not exist still satisfies
    // every check above. Both fallbacks render an nz-result; a real module does
    // not. Without this assertion the whole file passes for modules that are
    // gone — verified by adding a bogus route and watching it go green.
    await expect(
      page.locator('nz-result'),
      `${route} rendered the not-found/unauthorized fallback`,
    ).toHaveCount(0);

    const chunkErrors = consoleErrors.filter((e) =>
      /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported/i.test(e),
    );
    expect(chunkErrors, `${route} failed to load its chunk`).toEqual([]);
  });
}
