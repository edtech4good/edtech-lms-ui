/**
 * Drilldown — catches: the corporate theme silently rendering kids
 * structure (or the reverse — e.g. a bad uitheme claim, a useDesign
 * regression), and the curriculum → grade → module → lesson navigation
 * chain or its 3-activity-section lesson list breaking anywhere along the
 * way. LessonSelectionScreen.tsx has a real history of shipping empty
 * sections with intact titles (the section `type` key was once compared
 * against a translated title string, so every section header rendered but
 * none of its rows ever did) — titles alone would not catch a repeat of
 * that, so this also asserts a real, known row renders under each section.
 */
import { test, expect, Page } from '@playwright/test';
import {
  CORPORATE_STUDENT,
  KM,
  goToFirstDcrsLessonActivities,
  loginViaExpoUi,
} from './fixtures';

test.describe.configure({ mode: 'serial' });

test.describe('expo web drilldown (corporate / DCRS)', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test('home renders corporate structure, not kids', async () => {
    // This is the assertion the uitheme mutation proof targets: flipping
    // schools.uitheme to 'kids' for "Mekong Inclusive Ventures" removes both
    // of these (SubjectSelectionScreen's isCorporate branch and the (home)
    // layout's isRail nav rail) in favour of the kids DashboardCard grid and
    // CustomDrawer.
    await expect(page.getByText(KM.subjectGreeting, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: KM.logout })).toBeVisible();
  });

  test('curriculum -> grade -> module -> lesson reaches the activity list', async () => {
    await goToFirstDcrsLessonActivities(page);
    // All three activity sections, by their real Khmer section titles from
    // km.json — not just "something rendered". `.last()`: the level screen
    // behind this one in the (still-mounted) navigation stack renders these
    // same three labels again in miniature per lesson row, so a plain
    // getByText resolves to several elements — the lesson-list screen we
    // just navigated to is the most recently pushed, so its copy is last in
    // DOM order.
    await expect(page.getByText(KM.learningTitle, { exact: true }).last()).toBeVisible();
    await expect(page.getByText(KM.practiceTitle, { exact: true }).last()).toBeVisible();
    await expect(page.getByText(KM.quizTitle, { exact: true }).last()).toBeVisible();

    // A section title alone would not have caught the real bug this spec is
    // named after (see header comment) — every title rendered while every
    // row silently didn't. Assert a real, known row under each section too:
    // fixed seed:dcrs content, lesson 1's one item per activity type.
    await expect(
      page.getByRole('button').filter({ hasText: 'Animation: No plan vs clear vision' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button').filter({ hasText: 'Why direction matters practice' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button').filter({ hasText: 'Why direction matters quiz' }),
    ).toBeVisible();
  });
});
