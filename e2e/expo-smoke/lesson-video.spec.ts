/**
 * Lesson video — catches: a learning item whose video fails to resolve or
 * serve, whether from a broken document reference, a resource-URL
 * regression (getRemoteResourceUrl / useResource), or the player failing to
 * mount at all. Deliberately does not assert playback — only that a real
 * `<video>` element with a real, playable-looking `src` shows up.
 *
 * The src check is more than "non-empty": confirmed by mutation
 * (documents.documentname='' for the seeded dcrs-m1-l1.mp4 row) that the rpi
 * API's document lookup never actually returns an empty filename — an empty
 * documentname comes back as the literal string "invalid" (the API's own
 * fallback token), so getRemoteResourceUrl still builds a syntactically
 * non-empty (but dead) URL and a plain non-empty check stays green.
 * Requiring the src to end in a real video extension is what actually goes
 * red on that corruption.
 */
import { test, expect, Page } from '@playwright/test';
import {
  CORPORATE_STUDENT,
  goToFirstDcrsLessonActivities,
  loginViaExpoUi,
} from './fixtures';

test.describe.configure({ mode: 'serial' });

test.describe('expo web lesson video (corporate / DCRS)', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
    await goToFirstDcrsLessonActivities(page);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test('opening the learning item plays a real video', async () => {
    // Fixed seed:dcrs content: lesson 1's single learning item.
    await page
      .getByRole('button')
      .filter({ hasText: 'Animation: No plan vs clear vision' })
      .first()
      .click();

    const video = page.locator('video');
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute('src', /\.(mp4|mov|m4v|webm)([?#].*)?$/i);
  });
});
