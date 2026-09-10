/**
 * Phone learner path (corporate / DCRS) — catches regressions in the phone
 * portrait rework from ROADMAP Track B (edtech-expo, branch
 * feat/phone-learner-path). Only meaningful at phone width: run exclusively
 * by the `phone` project (390x844) in playwright.expo.config.ts, which the
 * `chromium` (1280x800) project explicitly ignores.
 *
 * What each test guards:
 *
 *  a) 'phone corporate shell is bottom tabs, not rail or drawer' — guards
 *     useNavShell.ts's isTabs branch and app/(app)/(home)/_layout.tsx's
 *     <Tabs> return: below theme.breakpoints.DEFAULT_MIN_WIDTH the corporate
 *     theme must render the bottom tab bar (tab-home / tab-profile
 *     testIDs), not the nav rail (isRail) or a Drawer instance (isDrawer).
 *     `tab-home`'s own y position pins it to the bottom of the viewport, so
 *     a regression that renders the tabs but docks them elsewhere (or
 *     shrinks the screen instead) still goes red.
 *
 *     There is no reliable role/name to assert "no DrawerButton" by:
 *     DrawerButton.tsx (src/components/buttons/DrawerButton.tsx) sets no
 *     accessibilityLabel anywhere in its chain (IconButton -> BaseButton ->
 *     Pressable), and km.json has no drawer-toggle string to borrow either
 *     — confirmed live against the running dev build (a Pressable there
 *     carries no `role` attribute at all on web). What IS discoverable,
 *     confirmed the same way, is @react-navigation/drawer's own hardcoded
 *     (non-localized) accessibility label on its Overlay component —
 *     "Close drawer" (node_modules/@react-navigation/drawer/.../Overlay.js)
 *     — which only exists in the DOM at all when some Drawer navigator is
 *     mounted (confirmed present for the kids theme's CustomDrawer, absent
 *     for corporate's phone Tabs). Asserting its absence is what actually
 *     catches "a Drawer leaked back into the corporate phone shell", which
 *     is the regression this test is named for.
 *
 *     Also asserts no 'No route named' console message — expo-router logs
 *     exactly that when a Tabs.Screen or Drawer.Screen name does not match
 *     a real route, the kind of mistake a shell-swap refactor invites.
 *
 *  b) 'profile tab navigates and comes back' — guards that the Tabs
 *     navigator's two screens (home, profile/index) actually route: tapping
 *     tab-profile must reach profile/index's real header. That header text
 *     comes from StudentProfileScreen.tsx's own
 *     `navigation.setOptions({ title: t('screen.profile.header') })`, which
 *     overrides the Tabs.Screen's static `title: t('drawer.profile')` at
 *     mount — confirmed live by mutating each independently (only
 *     StudentProfileScreen.tsx's own key changed the rendered header).
 *     Tapping tab-home must land back on the corporate SubjectSelectionScreen
 *     (KM.subjectGreeting). A regression that renders the right-looking tab
 *     bar chrome but wires the screens to the wrong route names (or
 *     href: null's the wrong screen) goes red here even though test (a)
 *     alone would not catch it.
 *
 *  c) 'MCQ options stack full-width above the tab bar' — guards
 *     PracticeMCQText.tsx's `isStacked` branch and useScreenDimension.ts's
 *     tabBarHeight subtraction together: below 768dp, MCQ options must
 *     render as a full-width vertical stack (not the landscape two-pane
 *     row), and PracticeFooter must sit entirely above the bottom tab bar,
 *     not underneath it. DCRS's seeded questions carry no media file, so
 *     the row/column flexDirection swap alone does not move option widths
 *     (see the spec's own mutation-proof, and the header comment on
 *     PracticeMCQText.tsx) — the footer-vs-tab-bar assertion is what
 *     catches a regression to useScreenDimension.ts's tabBarHeight
 *     handling, and is proved separately from the stacking/order assertion.
 *
 *  d) 'lesson video is a full-width 16:9 box' — guards LessonScreen.tsx's
 *     `playerHeight = isPortrait ? Math.round((width * 9) / 16) : height`
 *     branch: in phone portrait the video must be a full-width 16:9 box,
 *     not the full-window player landscape/tablet gets.
 */
import { test, expect, Page, ConsoleMessage } from '@playwright/test';
import {
  CORPORATE_STUDENT,
  KM,
  goToFirstDcrsLessonActivities,
  loginViaExpoUi,
} from './fixtures';

test.describe.configure({ mode: 'serial' });

test.describe('expo web phone learner path (corporate / DCRS)', () => {
  let page: Page;
  const consoleMessages: string[] = [];

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    page.on('console', (msg: ConsoleMessage) => consoleMessages.push(msg.text()));
    await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test('phone corporate shell is bottom tabs, not rail or drawer', async () => {
    const tabHome = page.locator('[data-testid="tab-home"]');
    const tabProfile = page.locator('[data-testid="tab-profile"]');
    await expect(tabHome).toBeVisible();
    await expect(tabProfile).toBeVisible();

    const tabHomeBox = await tabHome.boundingBox();
    expect(tabHomeBox).not.toBeNull();
    // Confirmed live at 390x844: the bottom tab bar sits at y=796 (viewport
    // height 844, bar height 48). 700 leaves comfortable margin against
    // header/content height changes elsewhere while still failing hard the
    // moment the shell is anything other than a bottom bar.
    expect(tabHomeBox!.y).toBeGreaterThan(700);

    // See header comment: this is @react-navigation/drawer's own Overlay
    // accessibility label, not DrawerButton's (which has none) — it is
    // present in the DOM whenever any Drawer navigator is mounted, and is
    // absent for the corporate phone Tabs shell.
    await expect(page.getByRole('button', { name: 'Close drawer' })).toHaveCount(0);

    // expo-router logs exactly this when a Tabs.Screen/Drawer.Screen name
    // doesn't match a real route — the kind of mistake a shell-swap
    // refactor invites. Excludes one pre-existing, unrelated warning
    // (confirmed live, present before and unrelated to this feature: the
    // root layout's own "(teacher)" route-group mismatch logs this on every
    // load regardless of nav shell) so this only goes red on a NEW one —
    // e.g. "home" or "profile/index", the Tabs' own screen names, going
    // missing.
    expect(
      consoleMessages.some(
        text => text.includes('No route named') && !text.includes('(teacher)'),
      ),
    ).toBe(false);
  });

  test('profile tab navigates and comes back', async () => {
    await page.locator('[data-testid="tab-profile"]').click();
    await expect(
      page.getByRole('heading', { name: KM.profileHeader }),
    ).toBeVisible();

    await page.locator('[data-testid="tab-home"]').click();
    await expect(page.getByText(KM.subjectGreeting, { exact: true })).toBeVisible();
  });

  test('MCQ options stack full-width above the tab bar', async () => {
    await goToFirstDcrsLessonActivities(page);

    // Fixed seed:dcrs content: lesson 1's single practice.
    await page
      .getByRole('button')
      .filter({ hasText: 'Why direction matters practice' })
      .first()
      .click();

    const radios = page.getByRole('radio');
    await expect(radios.first()).toBeVisible();
    const count = await radios.count();
    expect(count).toBeGreaterThan(0);

    let previousY = -Infinity;
    for (let i = 0; i < count; i++) {
      const box = await radios.nth(i).boundingBox();
      expect(box).not.toBeNull();
      // Full viewport width (390) minus the screen's own side padding —
      // 0.8x is generous enough to hold regardless of exact padding, but
      // still fails hard against the landscape two-pane row, where an
      // option's width is crushed to a ~180dp column instead.
      expect(box!.width).toBeGreaterThanOrEqual(0.8 * 390);
      expect(box!.y).toBeGreaterThan(previousY);
      previousY = box!.y;
    }

    const submitButton = page.getByRole('button', { name: KM.submitButton });
    const submitBox = await submitButton.boundingBox();
    const tabHomeBox = await page.locator('[data-testid="tab-home"]').boundingBox();
    expect(submitBox).not.toBeNull();
    expect(tabHomeBox).not.toBeNull();
    // The footer must clear the tab bar, not render underneath it —
    // guards useScreenDimension.ts's tabBarHeight subtraction.
    expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(tabHomeBox!.y);

    await expect(page.getByText(/^\d+\s*\/\s*\d+$/)).toBeVisible();
  });

  test('lesson video is a full-width 16:9 box', async () => {
    // Back to the home tab first: goToFirstDcrsLessonActivities assumes an
    // already-logged-in home screen, and test (c) leaves this shared page
    // deep in the practice screen. The bottom tab bar stays mounted and
    // visible even there (confirmed live), so tab-home is always reachable
    // regardless of what test (c) did — keeps this test's own
    // mutation-proof runnable in isolation (`--grep`) without depending on
    // test (c) having run and passed first, same reasoning
    // practice-quiz.spec.ts gives for its independent-login tests.
    await page.locator('[data-testid="tab-home"]').click();
    await goToFirstDcrsLessonActivities(page);

    // Fixed seed:dcrs content: lesson 1's single learning item.
    await page
      .getByRole('button')
      .filter({ hasText: 'Animation: No plan vs clear vision' })
      .first()
      .click();

    const video = page.locator('video');
    await expect(video).toBeVisible();
    const box = await video.boundingBox();
    expect(box).not.toBeNull();
    // LessonScreen.tsx: playerWidth = width, playerHeight =
    // Math.round(width * 9 / 16) in portrait — 390 * 9 / 16 = 219.375,
    // rounds to 219. Confirmed live at 390x844 (box was exactly
    // {width: 390, height: 219}). Hard-coded to the suite's default phone
    // viewport (not derived from it) so the mutation proof's
    // EXPO_E2E_PHONE_WIDTH=1280/HEIGHT=800 override — which puts
    // LessonScreen in its landscape branch (full 1280x800 player) — fails
    // this exactly as it should, rather than silently re-deriving a
    // passing expectation from the same overridden viewport.
    expect(Math.abs(box!.width - 390)).toBeLessThanOrEqual(1);
    expect(Math.abs(box!.height - 219)).toBeLessThanOrEqual(2);
  });
});
