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
 *  c) 'curriculum card and progress bar follow the type scale and contrast
 *     tokens' — added for the corporate type-scale/contrast fix. Guards
 *     three tokens at once, all on the DCRS curriculum card on the Home
 *     screen (miv.verify's card, always present since that account is
 *     always enrolled): CurriculumCard.tsx's title Text
 *     (`fontSize: theme.fontSizes.cardTitle`, now 20 not 13, and
 *     `useFont('bold', 'display')`, now the Bold display face not the
 *     SemiBold body face it used before the fix), the meta caption
 *     (`EyebrowText size={theme.fontSizes.caption}`, now 12 not 9), and
 *     ProgressBar.tsx's default-variant track
 *     (`backgroundColor: theme.colors.progressTrack`, now the slate
 *     `#4A5A6E` not the `#E3E8EF` hairline). Live-confirmed against the
 *     running dev build at 390x844, logged in as miv.verify: the title
 *     renders at exactly 20px in family `NotoSansKhmerBold`; the caption
 *     renders at 14px, not 12 — EyebrowText additionally bumps Khmer
 *     captions to `Math.max(caption, size + 2)` for legibility, so the
 *     assertion is a >=12 floor on the token, not an equality on the
 *     rendered value; the progress bar (`role="progressbar"`, confirmed
 *     react-native-web emits that attribute literally) has computed
 *     `backgroundColor: rgb(74, 90, 110)` (#4A5A6E). Title and caption are
 *     located by exact-text match scoped to the card's own button locator
 *     — CurriculumCard.tsx renders both as bare DIVs with no distinguishing
 *     role, and the card button's own aggregate text (title + caption +
 *     the "80%" pill) never equals either string exactly, so exact-text is
 *     what tells them apart without a testID. Mutation-proved one token at
 *     a time (Metrics.web.ts's cardTitle/caption, corporate.ts's
 *     progressTrack) — see the suite's mutation-proof notes for this
 *     branch; each assertion was independently driven red and restored.
 *
 *  d) 'MCQ options stack full-width above the tab bar' — guards
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
 *     Also asserts the practice question heading itself
 *     (PracticeHeading.tsx's corporate branch, a bare Text at
 *     `theme.fontSizes.subtitle`) renders at 18px, not the kids theme's
 *     32px H3 fallback (`fontSizes.h3`) that branch used to collapse to —
 *     confirmed live against the seeded q1 heading text.
 *
 *  e) 'lesson video is a full-width 16:9 box' — guards LessonScreen.tsx's
 *     `playerHeight = isPortrait ? Math.round((width * 9) / 16) : height`
 *     branch: in phone portrait the video must be a full-width 16:9 box,
 *     not the full-window player landscape/tablet gets.
 *
 *  f) 'profile tab navigates and comes back' (continued, same test) also
 *     guards app/(app)/(home)/_layout.tsx's Tabs branch `headerRight`
 *     (src/components/ui/LogoutButton.tsx): the phone shell has no
 *     drawer/rail, so the Profile tab's header is the only place a logout
 *     control can live — without it a learner on a phone cannot sign out at
 *     all. Asserts the button (AppIconButton, testID="logout-button",
 *     accessibilityRole="button", label KM.logout / drawer.logout) is both
 *     visible and actually sits in the header (y < 100 at 390x844), not
 *     buried somewhere else in the screen.
 *
 *  g) 'logout signs the learner out' — the actual click-through for (f),
 *     kept as its own final test because logging out ends the session:
 *     tapping the button must land on /login (not /home) with the login
 *     form's password input visible again. Must run last — every other
 *     test in this file assumes an already-logged-in session and navigates
 *     via tab-home.
 *
 *     Also guards src/redux/slices/AuthenticationSlice.ts's `clearAllData`
 *     reducer and useAuth.logout (edtech-expo): before that reducer existed,
 *     AuthenticationSlice had no extraReducers case for clearAllData at all,
 *     so logout's dispatch(clearAllData()) never touched this slice — the
 *     accessToken and profile redux-persist had already written to
 *     localStorage['persist:root'] survived the sign-out, and the next
 *     learner to open the app on that device inherited the previous
 *     learner's session. The URL/password-input assertions above passed
 *     under that bug too (router.replace('/login') ran regardless), so this
 *     test reads persist:root directly: a non-empty accessToken is asserted
 *     *before* the logout click (so the after-check below cannot pass
 *     vacuously against a session that was never actually persisted), and
 *     an empty accessToken with no profile is asserted after.
 */
import { test, expect, Page, ConsoleMessage } from "@playwright/test";
import {
  CORPORATE_STUDENT,
  KM,
  goToFirstDcrsLessonActivities,
  loginViaExpoUi,
} from "./fixtures";

test.describe.configure({ mode: "serial" });

/**
 * Reads the persisted authentication slice straight out of the web build's
 * redux-persist storage. Store.ts's persistConfig (edtech-expo/src/redux/
 * Store.ts) whitelists `authentication` under storage key `root`, and
 * @react-native-async-storage/async-storage's web shim backs AsyncStorage
 * with plain window.localStorage — so the persisted blob lives at
 * localStorage['persist:root'], itself a JSON object whose `authentication`
 * value is a second JSON string (redux-persist stringifies each whitelisted
 * slice separately). Returns null if nothing has been persisted yet.
 */
async function readPersistedAuth(
  page: Page
): Promise<{ accessToken?: string; profile?: unknown } | null> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("persist:root");
    if (!raw) return null;
    const root = JSON.parse(raw) as Record<string, string>;
    if (!root.authentication) return null;
    return JSON.parse(root.authentication);
  });
}

test.describe("expo web phone learner path (corporate / DCRS)", () => {
  let page: Page;
  const consoleMessages: string[] = [];

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    page.on("console", (msg: ConsoleMessage) =>
      consoleMessages.push(msg.text())
    );
    await loginViaExpoUi(
      page,
      CORPORATE_STUDENT.username,
      CORPORATE_STUDENT.password
    );
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("phone corporate shell is bottom tabs, not rail or drawer", async () => {
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
    await expect(
      page.getByRole("button", { name: "Close drawer" })
    ).toHaveCount(0);

    // expo-router logs exactly this when a Tabs.Screen/Drawer.Screen name
    // doesn't match a real route — the kind of mistake a shell-swap
    // refactor invites. The root layout's own former "(teacher)"
    // route-group mismatch (app/(app)/_layout.tsx) is fixed — that
    // Stack.Screen is now named "teacher", matching the real route — so
    // there is no longer a pre-existing warning to exclude here. ANY
    // "No route named" message now fails the test, e.g. "home" or
    // "profile/index", the Tabs' own screen names, going missing.
    expect(
      consoleMessages.some((text) => text.includes("No route named"))
    ).toBe(false);
  });

  test("profile tab navigates and comes back", async () => {
    await page.locator('[data-testid="tab-profile"]').click();
    await expect(
      page.getByRole("heading", { name: KM.profileHeader })
    ).toBeVisible();

    // See header comment (f): the phone shell has no drawer/rail, so this
    // header logout button (LogoutButton.tsx, rendered as the Profile tab's
    // headerRight) is the only way a phone learner can sign out. Must be
    // visible and actually live in the header, not just present somewhere
    // on the screen.
    const logoutButton = page.getByRole("button", { name: KM.logout });
    await expect(logoutButton).toBeVisible();
    const logoutBox = await logoutButton.boundingBox();
    expect(logoutBox).not.toBeNull();
    // Confirmed live at 390x844: the Profile tab's header sits well within
    // the first 100px. Generous enough to hold against header height
    // changes elsewhere while still failing hard if the button renders
    // outside the header (e.g. inline in the screen body instead of as
    // headerRight).
    expect(logoutBox!.y).toBeLessThan(100);

    await page.locator('[data-testid="tab-home"]').click();
    await expect(
      page.getByText(KM.subjectGreeting, { exact: true })
    ).toBeVisible();
  });

  test("curriculum card and progress bar follow the type scale and contrast tokens", async () => {
    // Test (b) ends on the Home screen (tab-home), where the DCRS
    // curriculum card lives — same locator goToFirstDcrsLessonActivities
    // uses to start its own drilldown.
    const dcrsCard = page
      .getByRole("button")
      .filter({ hasText: "DCRS" })
      .first();
    await expect(dcrsCard).toBeVisible();

    // CurriculumCard.tsx's title Text is a bare DIV with no distinguishing
    // role — confirmed live. Exact-text is what isolates it from the card's
    // own outer button: that button's aggregate text also includes the
    // "80%" progress pill and the meta caption, so it never equals the
    // title string exactly, but the title DIV itself does.
    const cardTitle = dcrsCard.getByText(
      "DCRS — Capital Readiness (Cohort II)",
      { exact: true }
    );
    await expect(cardTitle).toBeVisible();
    const titleFontSize = await cardTitle.evaluate(
      (el) => getComputedStyle(el).fontSize
    );
    expect(titleFontSize).toBe("20px");

    // The fix also switched the title from the SemiBold body face to the
    // Bold display face (CurriculumCard.tsx: useFont('bold', 'display')).
    // Under Khmer (the app's default language, and what this suite always
    // logs in as) that resolves to the registered family
    // NotoSansKhmerBold, not a Latin face name — confirmed live. Asserting
    // /Bold/ and NOT /SemiBold/ catches a regression back to
    // NotoSansKhmerSemiBold even if it somehow kept the 20px size.
    const titleFontFamily = await cardTitle.evaluate(
      (el) => getComputedStyle(el).fontFamily
    );
    expect(titleFontFamily).toMatch(/Bold/);
    expect(titleFontFamily).not.toMatch(/SemiBold/);

    // Meta caption text is curriculumdescription from
    // seed-dcrs-content.js, rendered via EyebrowText at
    // theme.fontSizes.caption. Confirmed live the actual value is 14px,
    // not 12: EyebrowText bumps Khmer captions to
    // Math.max(theme.fontSizes.caption, size + 2) = max(12, 14) = 14, so
    // the micro-label stays legible against Khmer's larger glyphs. The
    // assertion below is deliberately a >=12 floor on the token rather
    // than an equality on the rendered value — it still goes red the
    // moment fontSizes.caption itself regresses (see this branch's
    // mutation-proof: dropping caption to 9 makes EyebrowText's own bump
    // land at max(9, 11) = 11, which fails the floor) without being
    // coupled to EyebrowText's exact bump arithmetic.
    const cardCaption = dcrsCard.getByText("Seeded by npm run seed:dcrs", {
      exact: true,
    });
    await expect(cardCaption).toBeVisible();
    const captionFontSize = await cardCaption.evaluate(
      (el) => getComputedStyle(el).fontSize
    );
    expect(parseFloat(captionFontSize)).toBeGreaterThanOrEqual(12);

    // ProgressBar.tsx's outer View carries role="progressbar" directly —
    // confirmed live react-native-web emits that attribute literally, not
    // just an aria-valuenow — with the default variant's track colour
    // bound to theme.colors.progressTrack. miv.verify's DCRS card is
    // seeded with real progress (studentprogress rows), so
    // CurriculumCard's hasProgress check is true and the bar always
    // renders for this account; if a future reseed ever zeroed that out,
    // CurriculumCard stops rendering the bar entirely and this assertion
    // fails on visibility rather than silently skipping.
    const progressBar = dcrsCard.locator('[role="progressbar"]').first();
    await expect(progressBar).toBeVisible();
    const trackColor = await progressBar.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(trackColor).toBe("rgb(74, 90, 110)");
  });

  test("MCQ options stack full-width above the tab bar", async () => {
    await goToFirstDcrsLessonActivities(page);

    // Fixed seed:dcrs content: lesson 1's single practice.
    await page
      .getByRole("button")
      .filter({ hasText: "Why direction matters practice" })
      .first()
      .click();

    const radios = page.getByRole("radio");
    await expect(radios.first()).toBeVisible();

    // See header comment (d): guards PracticeHeading.tsx's corporate
    // branch (`theme.fontSizes.subtitle`) against falling back to the kids
    // theme's 32px H3. Confirmed live against the seeded q1 heading text.
    const questionHeading = page.getByText(
      "Which of these is a sign of running a business with no plan?",
      { exact: true }
    );
    await expect(questionHeading).toBeVisible();
    const questionFontSize = await questionHeading.evaluate(
      (el) => getComputedStyle(el).fontSize
    );
    expect(questionFontSize).toBe("18px");

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

    const submitButton = page.getByRole("button", { name: KM.submitButton });
    const submitBox = await submitButton.boundingBox();
    const tabHomeBox = await page
      .locator('[data-testid="tab-home"]')
      .boundingBox();
    expect(submitBox).not.toBeNull();
    expect(tabHomeBox).not.toBeNull();
    // The footer must clear the tab bar, not render underneath it —
    // guards useScreenDimension.ts's tabBarHeight subtraction.
    expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(tabHomeBox!.y);

    // Guards PracticeFooter.tsx's corporate `alignSelf: 'stretch'` fix
    // directly (audit U-04/U-05): the footer's outer View used to
    // shrink-wrap to its buttons — 296px wide at x≈47 on this 390 viewport —
    // because Container centres its children, which also collapsed the 4dp
    // `ProgressBar variant="quiz"` track's 100%-width bar to a null/zero-width
    // box (there was nothing to stretch against). stretch is what makes the
    // bar, and the track inside it, span the full screen width instead. Two
    // things are asserted here: the track running full-bleed across the
    // footer's top, and the Submit button (`<View style={{ flex: 1 }}>` +
    // `fullWidth`) growing to fill the row instead of sitting at its old
    // 72px.
    //
    // ProgressBar.tsx sets accessibilityRole="progressbar", which
    // react-native-web renders as role="progressbar" on web — confirmed live,
    // same as test (c) above. Unlike test (c)'s curriculum-card bar, there is
    // no container to scope the locator to here: the Home screen's own
    // curriculum-card progress bars stay mounted behind this screen's
    // navigation stack, so [role="progressbar"] matches several elements on
    // this page (confirmed live) — most with a null bounding box since
    // they're not actually laid out while hidden. The quiz track is picked
    // out by position instead: the one progress bar with a non-null box that
    // sits within 120px directly above the Submit button. Confirmed live at
    // 390x844: exactly one candidate matches, box {x: 0, y: 715, width: 390,
    // height: 4} — the Submit button's own box is {x: 16, y: 735, width:
    // 178.0625, height: 44} at that same run.
    const allProgressBars = page.locator('[role="progressbar"]');
    const progressBarCount = await allProgressBars.count();
    const tracksNearSubmit: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];
    for (let i = 0; i < progressBarCount; i++) {
      const box = await allProgressBars.nth(i).boundingBox();
      if (box !== null && box.y < submitBox!.y && box.y > submitBox!.y - 120) {
        tracksNearSubmit.push(box);
      }
    }
    expect(tracksNearSubmit.length).toBe(1);
    const trackBox = tracksNearSubmit[0];
    // Full-bleed: width ~= the 390 viewport (0.98x tolerance for the pill
    // radius/overflow rounding) and flush against the left edge, not the
    // pre-fix shrink-wrapped 296px box starting at x≈47.
    expect(trackBox.width).toBeGreaterThanOrEqual(0.98 * 390);
    expect(trackBox.x).toBeLessThanOrEqual(1);

    // Submit grows to fill its flex:1 wrapper instead of sitting at its
    // pre-fix ~72px content-hug width. Confirmed live the fixed button is
    // 178px wide (see box above) — comfortably past the 0.3x/117px floor,
    // which still fails hard against the old 72px.
    expect(submitBox!.width).toBeGreaterThanOrEqual(0.3 * 390);

    await expect(page.getByText(/^\d+\s*\/\s*\d+$/)).toBeVisible();
  });

  test("lesson video is a full-width 16:9 box", async () => {
    // Back to the home tab first: goToFirstDcrsLessonActivities assumes an
    // already-logged-in home screen, and test (d) leaves this shared page
    // deep in the practice screen. The bottom tab bar stays mounted and
    // visible even there (confirmed live), so tab-home is always reachable
    // regardless of what test (d) did — keeps this test's own
    // mutation-proof runnable in isolation (`--grep`) without depending on
    // test (d) having run and passed first, same reasoning
    // practice-quiz.spec.ts gives for its independent-login tests.
    await page.locator('[data-testid="tab-home"]').click();
    await goToFirstDcrsLessonActivities(page);

    // Fixed seed:dcrs content: lesson 1's single learning item.
    await page
      .getByRole("button")
      .filter({ hasText: "Animation: No plan vs clear vision" })
      .first()
      .click();

    const video = page.locator("video");
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

  test("logout signs the learner out", async () => {
    // See header comment (g): must run last — every earlier test in this
    // file assumes an already-logged-in session and navigates via
    // tab-home, and this one ends the session. Test (e) leaves the shared
    // page deep in the lesson video screen (home/lessons/[id].tsx), but
    // that route nests inside the "home" Tabs.Screen's own stack — the
    // bottom tab bar stays mounted throughout (same reasoning test (e)'s
    // own comment gives for tab-home staying reachable from test (d)'s
    // practice screen) — so tab-profile is clickable directly, no need to
    // detour through tab-home first.
    await page.locator('[data-testid="tab-profile"]').click();

    // Sanity check, not the regression assertion itself: confirms this
    // session actually persisted a real token before logout, so the
    // post-logout check below (accessToken === '') cannot pass vacuously
    // against a session that was never written to persist:root in the
    // first place.
    const before = await readPersistedAuth(page);
    expect(typeof before?.accessToken).toBe("string");
    expect(before!.accessToken!.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: KM.logout }).click();

    // LogoutButton.tsx's onPress calls useAuth's logout(), which clears
    // redux auth state and router.replace('/login') — confirmed live
    // against edtech-expo/src/services/hooks/useAuth.ts. A regression that
    // wires the button up to something else (or nothing) leaves the
    // learner on /home instead.
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).not.toMatch(/\/home/);
    await expect(page.locator('input[type="password"]').first()).toBeVisible();

    // See header comment (g): the URL/password-input assertions above would
    // have passed even under the pre-fix bug, since router.replace('/login')
    // ran regardless of whether the auth slice actually cleared. This is the
    // assertion that actually catches that bug. redux-persist's write-back
    // to localStorage isn't synchronous with the URL change, so poll rather
    // than reading persist:root exactly once.
    await expect
      .poll(async () => (await readPersistedAuth(page))?.accessToken, {
        timeout: 10_000,
      })
      .toBe("");
    const after = await readPersistedAuth(page);
    expect(after?.profile).toBeUndefined();
  });
});
