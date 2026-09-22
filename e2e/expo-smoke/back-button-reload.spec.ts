/**
 * Back-button-survives-reload — catches the regression the product owner
 * found on UAT 19 Sep 2026: click through Subjects -> Courses -> Units ->
 * Levels (or Lessons) and the header back arrow is there; reload the page
 * (or open the URL directly, which a reload simulates) and it vanishes,
 * because expo-router rebuilds the stack with that screen as its only
 * entry and the stock header only draws a back button when there is
 * history. LearnerBackButton (edtech-expo) fixes this by falling back to
 * the screen's logical parent via router.navigate when router.canGoBack()
 * is false.
 *
 * The pre-fix control isn't absent, it's a different element: before the
 * reload, react-navigation's own stock web header already draws a back
 * button (English "Go back") because there IS history at that point — it's
 * only the reload that kills it, since the rebuilt one-entry stack has none.
 * ANY_BACK (fixtures.ts) matches either control by accessible name, so each
 * test asserts a back control is visible before the reload (true either
 * way) and again after it (true only with the fix) — isolating the
 * assertion that actually exercises the regression to the post-reload line.
 */
import { test, expect, Page } from '@playwright/test';
import {
  ANY_BACK,
  CORPORATE_STUDENT,
  goToFirstDcrsLessonActivities,
  loginViaExpoUi,
} from './fixtures';

test.describe.configure({ mode: 'serial' });

test.describe('expo web back button survives reload (corporate / DCRS)', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test('Levels: back button survives a reload and goes to Units', async () => {
    // Same first three taps as goToFirstDcrsLessonActivities (fixtures.ts),
    // stopping one screen short of it: DCRS -> Cohort II -> Module 1 lands
    // on /home/levels without going on to pick a lesson.
    await page.getByRole('button').filter({ hasText: 'DCRS' }).first().click();
    await page.getByRole('button').filter({ hasText: 'Cohort II' }).first().click();
    await page.getByRole('button').filter({ hasText: 'Module 1' }).first().click();
    await expect(page).toHaveURL(/\/home\/levels(\?|$)/);

    // react-navigation keeps parent screens (subjects/courses/units) mounted
    // behind this one, so several DOM nodes can carry this accessible name —
    // though only the active screen's is actually in the accessibility tree
    // (measured: 1). .last() takes DOM order, which is the most recently
    // pushed screen, so it still picks the right one if that ever changes.
    await expect(page.getByRole('button', { name: ANY_BACK }).last()).toBeVisible();

    // The regression: a reload rebuilds the stack with /home/levels as its
    // only entry. Before the fix, no control with this name renders at all
    // here — this is the assertion the mutation proof targets.
    await page.reload();
    await expect(page).toHaveURL(/\/home\/levels(\?|$)/);
    await expect(page.getByRole('button', { name: ANY_BACK }).last()).toBeVisible();

    await page.getByRole('button', { name: ANY_BACK }).last().click();
    await expect(page).toHaveURL(/\/home\/units(\?|$)/);
  });

  test('Lessons: back button survives a reload and goes to Levels', async () => {
    // Re-drive from Subjects: goToFirstDcrsLessonActivities's full chain
    // (DCRS -> Cohort II -> Module 1 -> "Why direction matters") lands on
    // /home/lessons, the activity list for that lesson.
    await page.goto('/home/subjects');
    await goToFirstDcrsLessonActivities(page);
    await expect(page).toHaveURL(/\/home\/lessons(\?|$)/);

    await expect(page.getByRole('button', { name: ANY_BACK }).last()).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/home\/lessons(\?|$)/);
    await expect(page.getByRole('button', { name: ANY_BACK }).last()).toBeVisible();

    await page.getByRole('button', { name: ANY_BACK }).last().click();
    await expect(page).toHaveURL(/\/home\/levels(\?|$)/);
  });
});
