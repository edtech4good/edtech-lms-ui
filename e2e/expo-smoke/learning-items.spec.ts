/**
 * Learning items (edtech-expo LI-4) — catches: the lesson's learning list
 * regressing on typed items. A learning item whose type the build cannot
 * render (anything but `video` today) must show a "needs a newer version"
 * notice, must not be openable, must never be the footer button's target and
 * must never post progress; video items must still open; and every student-API
 * request must carry `X-Learning-Item-Types: video`.
 *
 * SEEDED DATA THIS SPEC EXPECTS (it cannot insert it — the suite has no
 * database access — so it SKIPS, with the reason, when the lesson it opens does
 * not have the shape below; it never fails for missing seed):
 *
 *  - Each themed account's lesson lists exactly three learning items, in
 *    this order: video, gallery, video. The middle one has
 *    `lessonlearningtype = 'gallery'` (and a NULL documentid); the gallery sits
 *    BETWEEN the videos so the footer button can only skip it if the next-step
 *    pick really skips it. The test reads the types from the lesson response,
 *    so no ids or names are hard-coded.
 *      kids      (KIDS_STUDENT, demo.sophea): the `npm run seed:content` lesson
 *                "Counting to ten" (Demo Curriculum / Demo grade / Demo level),
 *                which has one video; add the gallery (order 2) and a second
 *                video (order 3) by SQL on `lessonlearnings`.
 *      corporate (CORPORATE_STUDENT): DCRS lesson 1 ("Why direction matters"),
 *                same two rows added by SQL. On a throwaway/scratch database
 *                that has no miv.verify login ONLY, E2E_EXPO_CORPORATE_USER can
 *                point at another corporate learner that `seed:dcrs` creates
 *                there. Never do that against the shared local database or UAT:
 *                fixtures.ts forbids logging in as miv.demo (one token per
 *                user, so it would evict a session in use by someone else).
 *  - The expo-web build under test is edtech-expo >= the learning-items change
 *    (LI-4), and the student API is edtech-lms-rpi-api >= LI-2 (it returns
 *    `lessonlearningtype` and allows the header in CORS).
 *
 * No progress precondition: the footer test injects the statuses it needs by
 * rewriting the `.../activities/progress` response in the page (the same
 * interception approach as phone-lesson-status.spec.ts), so it does not depend on
 * studentlearningsprogress rows; test A's opening a video may leave one behind
 * (on a stack without media the player completes the item on load failure).
 *
 * Not covered here: "header absent on the central client" — no screen of the
 * app reaches the central client from the web UI; edtech-expo's unit test
 * src/services/api/__tests__/learningItemTypesHeader.ts proves it on the wire.
 *
 * Tests: A list + header, B footer skips the placeholder (corporate: the kids
 * list has no footer), C player screen refuses an unsupported item selected by
 * persisted state (the list row is not pressable, so this is the only coverage
 * of LessonScreen's guard), D kids card: only the art is dimmed (kids only).
 */
import { test, expect, Page, Request } from '@playwright/test';
import {
  CORPORATE_STUDENT,
  KIDS_STUDENT,
  KM,
  dismissResumePromptIfShowing,
  goToFirstDcrsLessonActivities,
  loginViaExpoUi,
  waitForLearningResourceLoaded,
} from './fixtures';

type Theme = 'corporate' | 'kids';
type Item = {
  lessonlearningid: string;
  lessonlearningname: string;
  lessonlearningorder: number;
  lessonlearningtype?: string;
};

/** The kids account's seeded lesson (`npm run seed:content`), reached like the DCRS drilldown. */
async function goToDemoLesson(page: Page): Promise<void> {
  for (const name of ['Demo Curriculum', 'Demo grade', 'Demo level', 'Counting to ten']) {
    await page.getByText(name).first().click();
  }
  await page.waitForURL(/\/home\/lessons\?lessonid=/, { timeout: 15_000 });
}

const THEMES: { theme: Theme; account: { username: string; password: string } }[] = [
  { theme: 'corporate', account: CORPORATE_STUDENT },
  { theme: 'kids', account: KIDS_STUDENT },
];

/** Records every fetch/xhr request, so the API origin can be learned from the lesson response afterwards. */
function recordRequests(page: Page) {
  const all: Request[] = [];
  page.on('request', (r) => {
    if (['fetch', 'xhr'].includes(r.resourceType()) && r.method() !== 'OPTIONS') all.push(r);
  });
  return all;
}

/**
 * Logs in and opens the seeded lesson's list. Returns the lesson's learning
 * items as the API sent them, plus the API origin. Skips (with the reason) if
 * the lesson is not the seeded video, gallery, video shape.
 */
async function openSeededLesson(
  page: Page,
  theme: Theme,
  account: { username: string; password: string },
  onItems?: (items: Item[]) => void
) {
  const all = recordRequests(page);
  await loginViaExpoUi(page, account.username, account.password);
  const lessonResponse = page.waitForResponse(
    (res) => res.request().method() === 'GET' && /\/lesson\/[^/]+\/learning$/.test(res.url()),
    { timeout: 20_000 }
  );
  if (theme === 'corporate') await goToFirstDcrsLessonActivities(page);
  else await goToDemoLesson(page);
  const res = await lessonResponse;
  const body = await res.json();
  const items = [...(body?.data?.lessonlearnings ?? [])].sort(
    (a: Item, b: Item) => a.lessonlearningorder - b.lessonlearningorder
  ) as Item[];
  onItems?.(items);
  const types = items.map((i) => i.lessonlearningtype ?? 'video');
  test.skip(
    types.join() !== 'video,gallery,video',
    `needs a lesson with learning items [video, gallery, video] in that order, found [${types.join(', ')}]: ` +
      'insert the gallery (order 2) and a second video (order 3) by SQL, see this file\'s header'
  );
  return { items, apiOrigin: new URL(res.url()).origin, all };
}

const apiRequests = (all: Request[], apiOrigin: string) => all.filter((r) => r.url().startsWith(apiOrigin));
const labelOf = (r: Request, apiOrigin: string) => `${r.method()} ${r.url().replace(apiOrigin, '')}`;

for (const { theme, account } of THEMES) {
  test.describe(`learning items (${theme})`, () => {
    test('A. two video items open, the gallery item is a placeholder, the header rides every API request', async ({ page }) => {
      const { items, apiOrigin, all } = await openSeededLesson(page, theme, account);
      const [video1, gallery, video3] = items;

      // The header: on every student-API request so far, with the one supported type.
      const reqs = apiRequests(all, apiOrigin);
      expect(reqs.length).toBeGreaterThan(3);
      for (const r of reqs) expect(r.headers()['x-learning-item-types'], r.url()).toBe('video');

      if (theme === 'corporate') {
        const row = (id: string) => page.getByTestId(`activity-row-learning-${id}`);
        await expect(row(video1.lessonlearningid)).toHaveAttribute('role', 'button');
        await expect(row(video3.lessonlearningid)).toHaveAttribute('role', 'button');
        await expect(row(gallery.lessonlearningid)).not.toHaveAttribute('role', 'button');
        await expect(row(gallery.lessonlearningid).getByTestId('unsupported-well')).toBeVisible();
        await expect(row(gallery.lessonlearningid).getByText(KM.unsupportedItem)).toBeVisible();
        await expect(row(gallery.lessonlearningid).locator('[data-testid^="status-icon-"]')).toHaveCount(0);
      } else {
        await expect(page.getByText(KM.unsupportedItem)).toHaveCount(1);
      }

      // The placeholder is not openable and posts nothing.
      const before = page.url();
      await page.getByText(gallery.lessonlearningname).first().click({ force: true });
      await page.waitForTimeout(1_500);
      expect(page.url()).toBe(before);
      const afterTap = apiRequests(all, apiOrigin).map((r) => labelOf(r, apiOrigin));
      expect(afterTap.filter((u) => u.includes(`/lesson/learning/${gallery.lessonlearningid}`)), afterTap.join('\n')).toEqual([]);
      expect(afterTap.filter((u) => u.startsWith('POST') && u.endsWith('/progress')), afterTap.join('\n')).toEqual([]);

      // A video item still opens the player with a real <video>.
      const learningResourceLoaded = waitForLearningResourceLoaded(page);
      await page.getByText(video3.lessonlearningname).first().click();
      await expect(page.locator('video')).toBeVisible();
      await expect(page.locator('video')).toHaveAttribute('src', /\.(mp4|mov|m4v|webm)([?#].*)?$/i);
      await learningResourceLoaded;
      await dismissResumePromptIfShowing(page);
      for (const r of apiRequests(all, apiOrigin)) {
        expect(r.headers()['x-learning-item-types'], r.url()).toBe('video');
      }
    });

    test('B. the footer button skips the placeholder', async ({ page }) => {
      test.skip(theme !== 'corporate', 'the kids list has no footer button');
      // Statuses injected whatever the database holds (test A opens a video, which
      // on a stack without media completes it). Progress reaches the screen from
      // two endpoints and a status is never downgraded once merged, so both are
      // rewritten: the level's /steps (all learnings not started: it is fetched
      // before the lesson's items are known) and the lesson's activities/progress
      // (video 1 done, everything else not started, by id once the items are known).
      let setItems: (items: Item[]) => void = () => undefined;
      const itemsKnown = new Promise<Item[]>((resolve) => (setItems = resolve));
      await page.route(/\/lesson\/level\/[^/]+\/steps(\?|$)/, async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        const data = body?.data ?? body;
        for (const lesson of data?.lessons ?? []) {
          for (const l of lesson.learnings ?? []) (l.status = 'todo'), (l.progress_percentage = 0);
        }
        await route.fulfill({ response, json: body });
      });
      await page.route(/\/lesson\/[^/]+\/activities\/progress(\?|$)/, async (route) => {
        const items = await itemsKnown;
        const response = await route.fetch();
        const body = await response.json();
        for (const l of body?.data?.learnings ?? []) {
          const done = l.lessonlearningid === items[0].lessonlearningid;
          l.status = done ? 'done' : 'todo';
          l.progress_percentage = done ? 100 : 0;
        }
        await route.fulfill({ response, json: body });
      });
      const { items, apiOrigin, all } = await openSeededLesson(page, theme, account, setItems);
      const [, gallery, video3] = items;

      // The next playable step is the third item. Its footer label ends with the
      // item's index within its type: "... 3", never the gallery's "... 2".
      const footer = page.getByText(new RegExp(`${KM.learningTitle} 3$`));
      await expect(footer).toBeVisible();
      await expect(page.getByText(new RegExp(`${KM.learningTitle} 2$`))).toHaveCount(0);
      await footer.click();
      await expect
        .poll(() => apiRequests(all, apiOrigin).filter((r) => r.url().endsWith(`/lesson/learning/${video3.lessonlearningid}`)).length)
        .toBeGreaterThan(0);
      expect(apiRequests(all, apiOrigin).filter((r) => r.url().includes(`/lesson/learning/${gallery.lessonlearningid}`))).toHaveLength(0);
    });

    test('C. the player screen refuses an unsupported item selected by persisted state', async ({ page }) => {
      const { items, apiOrigin, all } = await openSeededLesson(page, theme, account);
      const gallery = items[1];

      // Persist a selection of the gallery item, then open the player route
      // directly (a cold load, as after a restart or from a deep link). Set and
      // navigate in ONE synchronous step: the app's own persist writes would
      // otherwise land between the two and overwrite the selection.
      const mark = apiRequests(all, apiOrigin).length;
      // First let the app's own persist writes settle (a write landing after the
      // edit below would restore the old selection): wait until the stored
      // state has not changed for a second.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            let last = localStorage.getItem('persist:root');
            let stableSince = Date.now();
            const timer = setInterval(() => {
              const now = localStorage.getItem('persist:root');
              if (now !== last) (last = now), (stableSince = Date.now());
              else if (Date.now() - stableSince >= 1_000) (clearInterval(timer), resolve());
            }, 100);
          })
      );
      await page.evaluate((item) => {
        const root = JSON.parse(localStorage.getItem('persist:root') || '{}');
        const selection = JSON.parse(root.selection || '{}');
        selection.selectedModule = item;
        root.selection = JSON.stringify(selection);
        localStorage.setItem('persist:root', JSON.stringify(root));
        window.location.assign('/home/lessons/1');
      }, gallery);
      await page.waitForURL(/\/home\/lessons\/1/);
      await expect(page.getByTestId('unsupported-item-notice')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('unsupported-item-notice').getByText(KM.unsupportedItem)).toBeVisible();
      await page.waitForTimeout(3_000);

      const after = apiRequests(all, apiOrigin).slice(mark).map((r) => labelOf(r, apiOrigin));
      expect(after.filter((u) => u.includes(`/lesson/learning/${gallery.lessonlearningid}`)), after.join('\n')).toEqual([]);
      expect(after.filter((u) => u.startsWith('POST') && u.endsWith('/progress')), after.join('\n')).toEqual([]);
      await expect(page.locator('video')).toHaveCount(0);
    });

    test('D. kids card: only the art is dimmed, the title and the notice keep full opacity', async ({ page }) => {
      test.skip(theme !== 'kids', 'the corporate row has its own tinted surface, no dimming');
      const { items } = await openSeededLesson(page, theme, account);
      const opacityChain = (text: string) =>
        page.getByText(text, { exact: true }).first().evaluate((el) => {
          let o = 1;
          for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
          return o;
        });
      expect(await opacityChain(KM.unsupportedItem)).toBe(1);
      expect(await opacityChain(items[1].lessonlearningname)).toBe(1);
      // The card's art row is dimmed (the preview art carries a baked-in play button).
      const artOpacity = await page.getByText(KM.unsupportedItem).first().evaluate((el) => {
        // The nearest ancestor that holds an image is this card (the layout's depth differs between phone and desktop).
        const art = 'img, [style*="background-image"]';
        let card: Element | null = el.parentElement;
        while (card && !card.querySelector(art)) card = card.parentElement;
        const img = card?.querySelector(art) as HTMLElement | null;
        if (!card || !img) return -1;
        let o = 1;
        for (let n: Element | null = img; n && n !== card; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
        return o;
      });
      expect(artOpacity).toBeGreaterThan(0);
      expect(artOpacity).toBeLessThan(1);
    });
  });
}
