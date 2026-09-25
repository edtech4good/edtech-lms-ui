/**
 * Fixtures for the Expo web learner-app smoke suite (e2e/expo-smoke).
 *
 * edtech-expo is a sibling repo (Expo/React Native, not this Angular app).
 * This suite drives its web build (`expo start --web`, localhost:8081 by
 * default) as a black box over HTTP, the same way playwright.config.ts's
 * suite drives the Angular admin app here — it has no access to
 * edtech-expo's source and must never edit it.
 *
 * This suite is meant to graduate into edtech-expo itself once that repo
 * settles on a single package manager (it currently carries both a
 * package-lock.json and a yarn.lock). It lives here in the meantime because
 * this is the repo with a working Playwright setup and the house style
 * (e2e/fixtures/*.ts) to follow.
 *
 * demo.sophea (kids theme / Demo Primary School) and miv.verify (corporate
 * theme / DCRS curriculum) are the designated automation accounts for this
 * suite. Logging in as either writes real progress rows
 * (studentlearningsprogress, studentprogress, etc.) — that is expected, not
 * a leak, and this suite does not attempt to clean it up. Never log in as
 * demo.student or miv.demo here: the rpi API allows one token per user, and
 * those two accounts are in interactive use by others.
 */
import { Page, expect } from "@playwright/test";

/**
 * Shared default password for both automation accounts (both are seeded
 * with `demo`). This default is correct only for a local seed. A non-local
 * EXPO_WEB_URL requires E2E_EXPO_STUDENT_PASS alone, or both
 * E2E_EXPO_CORPORATE_PASS and E2E_EXPO_KIDS_PASS to be exported in the shell
 * — enforced by global-setup.ts. Overriding E2E_EXPO_STUDENT_PASS is also the
 * mutation-proof lever for login.spec.ts: `E2E_EXPO_STUDENT_PASS=wrong npm
 * run e2e:expo` breaks both accounts' logins and should turn the "reaches
 * home" assertions red.
 */
const DEFAULT_PASSWORD = process.env.E2E_EXPO_STUDENT_PASS ?? "demo";

export const KIDS_STUDENT = {
  username: process.env.E2E_EXPO_KIDS_USER ?? "demo.sophea",
  password: process.env.E2E_EXPO_KIDS_PASS ?? DEFAULT_PASSWORD,
};

export const CORPORATE_STUDENT = {
  username: process.env.E2E_EXPO_CORPORATE_USER ?? "miv.verify",
  password: process.env.E2E_EXPO_CORPORATE_PASS ?? DEFAULT_PASSWORD,
};

/**
 * Strings copied verbatim from edtech-expo/src/locales/km.json — never
 * hand-typed. The app defaults to Khmer, so these are what a real learner
 * session actually renders.
 */
export const KM = {
  loginButton: "ចូលគណនី", // screen.login.loginButton
  ok: "អូខេ", // button.ok
  logout: "ចាកចេញ", // drawer.logout
  // The corporate phone tab bar's profile/index Tabs.Screen
  // ((app)/(home)/_layout.tsx) sets title: t('drawer.profile') as its
  // static nav option, but StudentProfileScreen.tsx immediately overrides
  // that at mount via navigation.setOptions({ title: t('screen.profile
  // .header') }) — confirmed live (mutating the Tabs.Screen's own title had
  // no visible effect). screen.profile.header is what actually renders;
  // it is coincidentally the same Khmer string as drawer.profile.
  profileHeader: "ប្រវត្តិរូប", // screen.profile.header
  subjectGreeting: "អរុណសួស្តី", // screen.subject.greeting
  searchPlaceholder: "ស្វែងរកកម្មវិធីសិក្សា", // screen.subject.searchPlaceholder
  lessonHeader: "លំហាត់", // screen.lesson.header
  inThisLesson: "នៅក្នុងមេរៀននេះ", // screen.lesson.inThisLesson
  learningTitle: "សិក្សា", // screen.lesson.learningTitle
  practiceTitle: "អនុវត្ត", // screen.lesson.practiceTitle
  quizTitle: "តេស្ត", // screen.lesson.quizTitle
  submitButton: "បញ្ជូន", // screen.practice.submitButton
  correctButton: "បន្ទាប់", // screen.practice.correctButton
  incorrectButton: "សូមព្យាយាមម្តងទៀត", // screen.practice.incorrectButton
  correctTitle: "អបអរសាទរ!", // screen.practice.correctTitle
  incorrectTitle: "អូទេ!", // screen.practice.incorrectTitle
  // Generic ResultPopUp body copy (screen.practice.correctMessage /
  // incorrectMessage) — what a learner sees when the answered question has
  // no questionfeedback of its own. ResultPopUp.tsx only reaches these when
  // customMessages is undefined or its corresponding field is falsy.
  genericCorrectMessage: "ល្អណាស់!", // screen.practice.correctMessage
  genericIncorrectMessage: "ចម្លើយរបស់អ្នកមិនត្រឹមត្រូវទេ", // screen.practice.incorrectMessage
  resultHeader: "លទ្ធផល", // screen.result.header
  finishButton: "រួចរាល់", // screen.result.finishButton
  back: "ត្រឡប់ក្រោយ", // button.back
} as const;

/**
 * questionfeedback seeded onto exactly one DCRS question (q1 — "Which of
 * these is a sign of running a business with no plan?", the single question
 * behind both lesson 1's practice AND its quiz) by both
 * edtech-lms-api/scripts/seed-dcrs-content.js and
 * edtech-lms-rpi-api/scripts/seed-dcrs-content.js (kept in lockstep — see
 * comments there). Copied verbatim, not hand-typed a second time, so a typo
 * in one place cannot silently pass against a typo in the other.
 */
export const Q1_FEEDBACK = {
  correctMessage: "ល្អណាស់! អ្នកយល់ច្បាស់ហើយ។",
  incorrectMessage: "សាកល្បងម្តងទៀត ហើយពិនិត្យមេរៀនឡើងវិញ។",
} as const;

/** Matches whichever of the two ResultPopUp buttons is currently showing. */
export const RESULT_POPUP_BUTTON = new RegExp(
  `^(${KM.correctButton}|${KM.incorrectButton})$`
);

/** Any back control: the app's own labelled BackButton (button.back, Khmer)
 *  or react-navigation's stock web header button, whose accessible name is
 *  the hard-coded English "Go back". */
export const ANY_BACK = /^(ត្រឡប់ក្រោយ|Go back)$/;

/**
 * Logs in through the real form. Both UI themes share the same input types
 * and the same (translated) submit button copy — only the surrounding
 * chrome differs — so one helper covers both. There is no storageState to
 * reuse across contexts the way there is for the Angular admin app (see
 * e2e/fixtures/auth.ts there): this app keeps auth in memory/redux with no
 * persisted state this suite can safely read, so every spec logs in fresh
 * through the UI.
 */
export async function loginViaExpoUi(
  page: Page,
  username: string,
  password: string
): Promise<void> {
  await page.goto("/");
  // Neither input carries a name/id/testID (confirmed against the live
  // dev build) — type + order is the only stable handle RN-web gives us.
  await page.locator('input[type="text"]').first().fill(username);
  await page.locator('input[type="password"]').first().fill(password);
  // Text, not role: the kids theme's FilledButton (unlike corporate's
  // AppButton) never sets accessibilityRole="button", and which theme is
  // showing here depends on this browser's default/last-touched dev theme
  // pill, not on which account is about to log in — a fresh context (no
  // localStorage) boots kids. getByText works regardless of which one
  // rendered.
  await page.getByText(KM.loginButton, { exact: true }).click();
  await page.waitForURL(/\/home/, { timeout: 15_000 });
}

/**
 * Drives the corporate DCRS drilldown from an already-logged-in home screen
 * (CORPORATE_STUDENT / miv.verify) down to a lesson's activity list:
 * curriculum → grade → module → lesson. `lessonTitle` matches the lesson
 * card by substring — defaults to lesson 1 ("Why direction matters"), the
 * original and still most-used target. The card titles are the fixed
 * `npm run seed:dcrs` content (edtech-lms-rpi-api) that miv.verify's school
 * is seeded with — confirmed against the running dev stack, not guessed.
 * Every card on the way is a role="button" wrapping its title text.
 */
export async function goToFirstDcrsLessonActivities(
  page: Page,
  lessonTitle = "Why direction matters"
): Promise<void> {
  await page.getByRole("button").filter({ hasText: "DCRS" }).first().click();
  await page
    .getByRole("button")
    .filter({ hasText: "Cohort II" })
    .first()
    .click();
  await page
    .getByRole("button")
    .filter({ hasText: "Module 1" })
    .first()
    .click();
  await page
    .getByRole("button")
    .filter({ hasText: lessonTitle })
    .first()
    .click();
  // v2.1 (edtech-expo #93/#94, localhost:8091) drops the corporate Lesson
  // screen's app-bar title (screen.lesson.header / KM.lessonHeader) — the
  // app-bar shows only a back chevron now — so a heading assertion here
  // breaks against that build while this helper is also shared by specs
  // that still run against the pre-v2.1 build (e.g. the default
  // EXPO_WEB_URL/localhost:8081). Wait instead for the URL actually
  // reaching the lessons route, then for the lesson data itself to have
  // loaded.
  //
  // The wait below used to be:
  //   page.locator('[data-testid^="activity-row-"]')
  //     .or(page.getByRole('button').filter({ hasNotText: ANY_BACK }))
  // which was vacuous: `hasNotText` filters on an element's own *visible
  // text*, but the back IconButton's label is only an accessibilityLabel
  // (button.back, ANY_BACK) — it has no visible text at all — so
  // `hasNotText: ANY_BACK` never excludes it, and `.or(...).first()` just
  // resolved to whichever button (often the back chevron itself) painted
  // first. The wait could pass before the lesson finished loading, or even
  // on a route with an empty activity list, as long as SOME button was on
  // the page.
  //
  // Wait instead for a string that only renders after the lesson data has
  // actually loaded, in either build:
  //  - v2.1 (localhost:8091): LessonSelectionScreen.tsx's corporate branch
  //    sits behind the `_.isEmpty(lesson)` early return (~line 253) — the
  //    screen renders only a bare background View until `lesson` has
  //    loaded. The first text that branch renders is the "In this lesson"
  //    header (~line 446, `t('screen.lesson.inThisLesson')`, KM.inThisLesson
  //    — a plain Text with no accessibilityRole), directly above the
  //    activity rows this helper exists to reach.
  //  - pre-v2.1 (e.g. origin/main, the default EXPO_WEB_URL/localhost:8081):
  //    confirmed by reading
  //    `git show origin/main:src/screens/LessonSelection/LessonSelectionScreen.tsx`
  //    — that build has no "In this lesson" string at all, but shares the
  //    same `_.isEmpty(lesson)` early return (~line 238) gating the
  //    corporate branch, and sets the nav header's title to
  //    `t('screen.lesson.header')` (KM.lessonHeader) via
  //    `navigation.setOptions`, which react-navigation's web header renders
  //    with an accessible `role="heading"`. Match on that as the fallback.
  //  Either way, `.first()` picks whichever of the two actually rendered —
  //  never a button that says nothing about whether the lesson loaded.
  await page.waitForURL(/\/home\/lessons(?:[/?]|$)/, { timeout: 15_000 });
  await expect(
    page
      .getByText(KM.inThisLesson, { exact: true })
      .or(page.getByRole("heading", { name: KM.lessonHeader }))
      .first()
  ).toBeVisible();
}

/**
 * Strings copied verbatim from edtech-expo/src/locales/km.json's `player`
 * and `button` blocks (never hand-typed) — the lesson video controller's
 * button accessibilityLabels and the Slider accessibilityLabels
 * (VideoControl.tsx). Confirmed live against the running dev build: on web,
 * `@react-native-community/slider`'s accessibilityRole="adjustable" maps to
 * ARIA role="slider" (react-native-web's propsToAriaRole), so these are
 * located with `getByRole('slider', { name: ... })`, the same pattern
 * `getByRole('radio', ...)` already uses elsewhere in this suite for RN
 * accessibilityRole -> ARIA role mapping. Confirmed live that the Slider's
 * `accessibilityValue={{ text: ... }}` prop (the elapsed/duration
 * announcement) does NOT reach the DOM at all on web — react-native-web only
 * understands the flat `accessibilityValueText`/`Now`/`Min`/`Max` props, not
 * RN's nested `accessibilityValue` object, so `aria-valuetext`/`aria-valuenow`
 * are both null on every slider here. The elapsed/duration mm:ss labels next
 * to the seek slider (plain H4 text, not part of the slider itself) are the
 * only web-visible way to read position — see readLessonElapsedLabel and
 * readLessonDurationLabel below.
 */
export const PLAYER_KM = {
  play: "ចាក់", // player.play
  pause: "ផ្អាក", // player.pause
  rewind: "ថយក្រោយ ១០ វិនាទី", // player.rewind
  volume: "កម្រិតសំឡេង", // player.volume
  seek: "ទីតាំងវីដេអូ", // player.seek
  close: "បិទ", // button.close
} as const;

/**
 * ResumeVideoPopUp.tsx's translated strings (resumeVideo.question,
 * button.no/yes), copied verbatim from km.json — this suite always runs in
 * Khmer (see loginViaExpoUi's own comment: a fresh context boots the app in
 * Khmer). No/Yes are OutlineButton/FilledButton, which — confirmed live,
 * same as this file's existing RESULT_POPUP_BUTTON note for other custom
 * buttons — set no accessibilityRole, so they render as plain, unlabelled
 * DIVs on web; locate by their own text, not getByRole('button', ...).
 */
export const RESUME_KM = {
  question: "តើអ្នកចង់បន្តពីកន្លែងដែលបានឈប់លើកមុនទេ?", // resumeVideo.question
  no: "ទេ", // button.no
  yes: "បាទ/ចាស", // button.yes
} as const;

/**
 * Reads the lesson video's elapsed-time label (VideoControl.tsx's
 * `<H4>{readableSeekPosition}</H4>`, e.g. "0:03"). Confirmed live via a full
 * DOM walk from the seek Slider (see PLAYER_KM's header comment for why the
 * slider's own ARIA attributes can't be used instead): the Slider's
 * grandparent Row renders exactly 5 children in DOM order — [elapsed H4,
 * spacer, the Slider's own wrapper, spacer, duration H4] — regardless of
 * whether VideoControl is in its compact (stacked) or wide layout, since
 * that row is unaffected by the isCompact branch (only the row ABOVE it,
 * holding transport/volume, changes). Duration is `children[4]`, used by
 * `readLessonDurationLabel` below — lesson-player-polish.spec.ts reads both
 * to derive its own wait/skip budgets from the clip's actual length instead
 * of a hardcoded number.
 */
export async function readLessonElapsedLabel(page: Page): Promise<string> {
  return page.getByRole("slider", { name: PLAYER_KM.seek }).evaluate((el) => {
    const row = el.parentElement?.parentElement;
    return row?.children[0]?.textContent ?? "";
  });
}

/** See readLessonElapsedLabel's header comment — the fixed total-duration
 *  label (e.g. "0:13"), the 5th child of the same row. */
export async function readLessonDurationLabel(page: Page): Promise<string> {
  return page.getByRole("slider", { name: PLAYER_KM.seek }).evaluate((el) => {
    const row = el.parentElement?.parentElement;
    return row?.children[4]?.textContent ?? "";
  });
}

/**
 * Waits for the network response that decides whether ResumeVideoPopUp can
 * show at all: LessonScreen's mount effect calls useLearning's fetch(),
 * which calls Api.fetchVideoPath — `GET lesson/learning/${lessonLearningId}`
 * (confirmed by reading edtech-expo's src/services/api/Api.ts directly, not
 * by observing live traffic this round). That response is what flips
 * `loaded` true and populates `learningResource` (dispatched via
 * SelectionActions.updateModuleResource); handleResumeProgress's effect
 * (keyed on `[learningResource, video.current]`) can't decide whether to
 * show the popup before then. MUST be called (or its returned promise
 * captured) BEFORE the click that opens/reopens the learning item —
 * page.waitForResponse only catches responses that complete AFTER it starts
 * listening, so awaiting this after the item is already open can hang past
 * its own timeout waiting for a request that already finished.
 *
 * The predicate requires GET and a URL that ends right after the id (no
 * trailing segment) — Api.ts's saveVideoProgress POSTs to
 * `lesson/learning/${lessonLearningid}/progress` (Api.ts around line 331),
 * a DIFFERENT endpoint that also contains the substring "lesson/learning/"
 * and fires on unmount (e.g. right after the close-button click in
 * lesson-player-polish.spec.ts's resume-prompt test, test (b)→(c) in that
 * file's own flow). An earlier version of this helper matched on that bare
 * substring and could have resolved against the progress-save POST instead
 * of the actual GET this function exists to wait for — found by re-reading
 * Api.ts, not by observing it live.
 *
 * No `.catch()` here: a timeout (or a URL-pattern regression that stops
 * matching anything) fails LOUDLY, not silently. Swallowing it would let
 * exactly the race this function exists to close back in unnoticed if the
 * pattern above is ever wrong.
 *
 * Exercised in the 24 Sep 2026 runs against edtech-expo a9dda01: the
 * `chromium` project (which is where every caller of this function lives —
 * openFreshDcrsLessonVideo, lesson-video.spec.ts, phone-learner-path.spec.ts)
 * ran all green, including with miv.verify's lesson 1 already carrying real
 * saved progress, so this GET-only/no-`/progress`-suffix pattern has
 * matched correctly across every one of those runs without a false match
 * or a hang.
 */
export async function waitForLearningResourceLoaded(page: Page): Promise<void> {
  await page.waitForResponse(
    (res) =>
      res.request().method() === "GET" &&
      /\/lesson\/learning\/[^/?]+(\?|$)/.test(res.url()),
    { timeout: 10_000 }
  );
}

/**
 * Dismisses the ResumeVideoPopUp if it's showing (e.g. left over from a
 * previous run's saved progress — LessonScreen.tsx shows it whenever the
 * item's studentlearningprogress.progress is >= 5s, independent of anything
 * this test run has done yet — see e.g. lesson-video.spec.ts and
 * phone-learner-path.spec.ts, which hit exactly this via a shared account).
 * Tests that need a KNOWN starting state call this before relying on
 * isPlaying/positionMillis defaults; tests that assert the popup's own
 * content trigger it deliberately instead (see lesson-player-polish.spec.ts).
 *
 * Callers should await waitForLearningResourceLoaded (captured BEFORE the
 * click that opened the item) first, so the wait below only has to cover
 * the Modal's own fade-in (animationType="fade"), not the network round
 * trip — confirmed live in an earlier round that checking immediately
 * after opening the item (with no such wait) could race the fade-in and
 * miss the popup entirely, leaving a Modal covering the controller that
 * then made every later click in the test time out with "subtree
 * intercepts pointer events" instead of a clear failure. The timeout here
 * is kept generous (1.5s, well over the Modal's actual fade) as a margin of
 * safety over the Modal's fade.
 *
 * Fails LOUDLY, not silently, if a resume prompt appears in English instead
 * of Khmer: that's the exact regression lesson-player-polish.spec.ts's own
 * resume-prompt test exists to catch (ResumeVideoPopUp.tsx's t() calls
 * reverting to hardcoded English), and a caller that only ever looks for
 * the Khmer "No" text would otherwise just hang until its own timeout with
 * no indication why — waiting on the two texts together in the app's
 * actual default language shows the failure directly.
 */
export async function dismissResumePromptIfShowing(page: Page): Promise<void> {
  const khmerNo = page.getByText(RESUME_KM.no, { exact: true });
  const englishQuestion = page.getByText(/resume from your previous session/i);
  const either = khmerNo.or(englishQuestion);

  const appeared = await either
    .first()
    .waitFor({ state: "visible", timeout: 1_500 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return;

  if (await englishQuestion.isVisible().catch(() => false)) {
    throw new Error(
      "ResumeVideoPopUp rendered in English (\"...resume from your previous " +
        `session...\"), not Khmer ("${RESUME_KM.question}") — this is the ` +
        "regression lesson-player-polish.spec.ts's own resume-prompt test " +
        "guards (ResumeVideoPopUp.tsx's t() calls reverting to hardcoded " +
        "English text)."
    );
  }

  await khmerNo.click();
  await expect(khmerNo).toHaveCount(0);

  // Direct "stays gone" check, not just "closed once": the actual bug this
  // suite hit against edtech-expo 50dcec8 (before the a9dda01 fix) was the
  // modal closing on click and then reopening moments later —
  // handleResumeProgress's effect re-firing once `video.current` changed
  // to a new ref after `key={source}` remounted `<Video>`. The
  // toHaveCount(0) above alone would have passed at the exact instant the
  // click landed, whether or not the popup came back right after — it
  // proves the click closed it once, not that it stayed closed. Watches
  // the whole window instead of a fixed sleep + single re-check, so a
  // reopen ANY time in that window is caught, not just one it happens to
  // land on, and so a regression back to that behaviour fails HERE with a
  // clear message instead of surfacing later as an unrelated pointer-
  // interception timeout on whatever the caller does next. Not itself
  // shown to fail: the once-per-item-guard mutation fails at the
  // toHaveCount(0) above first (the prompt never closes), so this line has
  // not been seen red. The 1.5s window is a guess at "moments later", not
  // a measured reopen delay.
  const reappeared = await khmerNo
    .waitFor({ state: "visible", timeout: 1_500 })
    .then(() => true, () => false);
  expect(
    reappeared,
    "resume prompt reappeared within 1.5s of being dismissed (the key={source} " +
      "remount-reopens-the-modal regression a9dda01 fixed)"
  ).toBe(false);
}

/**
 * VideoControl.tsx auto-hides its whole controller bar shortly after
 * playback starts (`hideController`, triggered by the `useEffect` watching
 * `isPlaying`) by animating its wrapping Pressable's opacity to 0 AND
 * flipping a `disabled` form flag that every button/slider handler except
 * the close button checks before acting — confirmed live: once a clip has
 * played a couple of seconds, the play/pause button's own ancestor chain
 * has one `opacity: '0'` in it, and clicking that button (or the seek/
 * volume sliders) no longer does anything, even though Playwright still
 * considers it "visible" (opacity alone isn't a Playwright visibility
 * signal). This is pre-existing VideoControl.tsx behaviour, not something
 * this branch's fix touches — but the "replay from the end" behaviour it
 * fixed only shows up by playing to the real end of the clip (see that
 * test's own comment for why seeking there directly isn't a viable
 * shortcut), so tests need a way to "wake" the bar back up before pressing
 * Play a second time. Clicking anywhere on the player that ISN'T a button
 * re-triggers `VideoControl`'s outer Pressable's own onPress
 * (`handleControllerState`), which calls `showController()` when
 * `isPlaying` is false (true here, since the clip has just finished) —
 * confirmed live: clicking near the top of the video element (away from
 * the bottom-anchored controller bar, so the click can't land on a real
 * button) restores every ancestor's opacity to '1' within under a second,
 * and the play button becomes clickable again. `elementFromPoint` at that
 * spot resolves to the Pressable's own plain DIV (`cursor: pointer`), not
 * the `<video>` element or a button.
 */
export async function wakeLessonVideoController(page: Page): Promise<void> {
  const videoBox = await page.locator("video").boundingBox();
  if (!videoBox) return;
  await page.mouse.click(videoBox.x + videoBox.width / 2, videoBox.y + 100);
  // Outlasts showController's own 700ms opacity animation.
  await page.waitForTimeout(900);
}

/**
 * Reopens the DCRS lesson 1 learning item ("Animation: No plan vs clear
 * vision") as a FRESH LessonScreen mount — closing it first via the
 * controller's close button (accessibilityLabel button.close, "បិទ",
 * confirmed live always present and enabled: it sits outside
 * VideoControl.tsx's own auto-hiding controller bar, so it's never disabled
 * by the hideController-on-play behaviour that guards the bar's other
 * buttons) if a lesson screen is already open. A fresh mount is what resets
 * LessonScreen's local `stat` form state (isPlaying: false, positionMillis:
 * 0) — reusing an already-open screen after a previous test played or
 * seeked it would start the next test from wherever that left off. Ends by
 * clearing any resume prompt so callers can rely on isPlaying/positionMillis
 * being at their mount defaults.
 */
export async function openFreshDcrsLessonVideo(page: Page): Promise<void> {
  const closeButton = page.getByRole("button", { name: PLAYER_KM.close });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  } else {
    await goToFirstDcrsLessonActivities(page);
  }
  // Captured BEFORE the click below — see waitForLearningResourceLoaded's
  // own header comment for why that ordering matters.
  const learningResourceLoaded = waitForLearningResourceLoaded(page);
  await page
    .getByRole("button")
    .filter({ hasText: "Animation: No plan vs clear vision" })
    .first()
    .click();
  await expect(page.locator("video")).toBeVisible();
  await learningResourceLoaded;
  await dismissResumePromptIfShowing(page);
}
