/**
 * Lesson player polish (corporate / DCRS) — catches regressions in three
 * width-independent fixes plus the desktop/wide side of the compact-layout
 * fix, all from edtech-expo branch fix/lesson-player-polish. App under
 * test: edtech-expo at commit a9dda01 (includes 06aaabe, the original
 * lesson-player-polish commit this file's tests were written against, and
 * 50dcec8, the Android `key={source}` fix — a9dda01 itself fixes a stuck
 * ResumeVideoPopUp regression that 50dcec8 introduced on web; see test (c)'s
 * header comment). Run by the `chromium` project (1280x800) only — this file does
 * not match `phone-*.spec.ts`, so playwright.expo.config.ts's `phone`
 * project never picks it up. Width-independent assertions (progress
 * ticking, replay-from-end, the translated resume prompt) are here rather
 * than in phone-lesson-player.spec.ts because none of them depend on
 * viewport width — nothing about their mechanism (the elapsed label's
 * ticking, handlePlay's replayAsync branch, ResumeVideoPopUp's i18n) is
 * gated on VideoControl's isCompact breakpoint, so running them once at
 * desktop width is representative and keeps the phone spec focused purely
 * on the one thing that IS width-gated.
 *
 * Locating the controls: `@react-native-community/slider`'s
 * accessibilityRole="adjustable" maps to ARIA role="slider" on web
 * (react-native-web's propsToAriaRole — confirmed by reading
 * node_modules/react-native-web/dist/modules/AccessibilityUtil/propsToAriaRole.js
 * in the edtech-expo worktree), so both sliders are located with
 * `getByRole('slider', { name: ... })`. Confirmed live in Chromium that the
 * Slider's `accessibilityValue={{ text: ... }}` prop (the
 * player.elapsedOfTotal announcement) does NOT reach the DOM at all on
 * web — react-native-web only understands the flat
 * accessibilityValueText/Now/Min/Max props, not RN's nested
 * accessibilityValue object, so `aria-valuetext`/`aria-valuenow` are both
 * null on every slider here (verified via
 * `document.querySelectorAll('[role="slider"]')[...].getAttribute('aria-valuetext')`
 * against the running dev build). The only web-visible way to read
 * position is the plain-text elapsed/duration H4 labels next to the seek
 * slider — see fixtures.ts's readLessonElapsedLabel/readLessonDurationLabel
 * for how they're located (a DOM walk from the seek slider, confirmed live:
 * its grandparent Row's children are [elapsed H4, spacer, slider wrapper,
 * spacer, duration H4], in that order regardless of isCompact).
 *
 * What each test guards:
 *
 *  a) 'elapsed label advances during playback' — does NOT guard the actual
 *     native fix, and the `progressUpdateIntervalMillis` 5000 -> 1000 value
 *     in LessonScreen.tsx is NOT that fix on any platform. The real native
 *     bug and fix (from the device, Android emulator, Expo Go dev build,
 *     24 Sep 2026): expo-av 13.10 on Android loses
 *     progressUpdateIntervalMillis entirely — interval silently becomes 0,
 *     so no ticks fire at all — when a mounted `<Video>`'s `source` prop
 *     changes without the component remounting (a putInt/getDouble Bundle
 *     type mismatch on the native side). Fixed in edtech-expo by adding
 *     `key={source}` to `<Video>`, forcing a remount on every source change
 *     instead of a prop update. The 5000 -> 1000 number is unrelated to
 *     that bug and has no effect on web either: expo-av's web
 *     implementation ignores progressUpdateIntervalMillis entirely
 *     (node_modules/expo-av/src/ExponentAV.web.ts — the prop's handling is
 *     commented out there; web always reports position on the browser's own
 *     `timeupdate` cadence, regardless of the prop's value). Confirmed
 *     live: reverting the prop to 5000 and re-running left this test green,
 *     no change in behaviour — consistent with the web platform ignoring it
 *     and irrelevant to the real (Android, `key={source}`) fix in any case.
 *     What this test actually mutation-proves is narrower — only that a
 *     real, live-advancing elapsed label exists at all on web. Proven
 *     lever: hardcoding VideoControl.tsx's `readableSeekPosition` to always
 *     return `msToDuration(0)` turns this red (elapsed never leaves
 *     "0:00") — restored with `git checkout --
 *     src/screens/Lesson/components/VideoControl.tsx` afterwards. The
 *     `key={source}` fix itself is Android-only and has no e2e coverage in
 *     this file; it would need a native/device run to verify.
 *
 *  b) 'play after the end restarts playback (web regression coverage)' —
 *     web-only coverage that pressing Play once a clip has finished
 *     actually resumes playback from 0:00, rather than doing nothing.
 *     IMPORTANT SCOPE CAVEAT, found while trying to mutation-prove this
 *     branch: this assertion CANNOT distinguish LessonScreen.tsx's fixed
 *     handlePlay (which calls `video.current.replayAsync()` at end-of-clip)
 *     from the pre-fix code (a plain `playAsync()` call) on the web build —
 *     confirmed live by mutating replayAsync() back to playAsync() and
 *     re-running: the test stayed GREEN. Reading expo-av's web source
 *     (node_modules/expo-av/src/ExponentAV.web.ts) shows why: both
 *     branches end up calling the underlying HTML5 `<video>.play()`, and
 *     per spec, Chromium already restarts playback from 0 on its own when
 *     `.play()` is called on an element that has reached `ended` —
 *     independent of which JS method the app called. So on web the FIXED
 *     code still takes the replayAsync() branch at end-of-clip, and what
 *     this test actually guards is narrower than its name suggests: that
 *     the new replayAsync() branch doesn't itself break web playback (e.g.
 *     throw, or leave the player stuck) now that handlePlay takes it
 *     instead of the old plain-playAsync() branch. Mutation lever for that
 *     narrower claim: an early `return;` at the top of the replayAsync()
 *     branch, before the `await` — RED (24 Sep 2026): elapsed stayed
 *     pinned at the clip's duration instead of dropping back near 0:00.
 *     The replayAsync()-vs-playAsync() distinction itself is a NATIVE
 *     (iOS/Android) difference — expo-av's native players do NOT
 *     auto-restart on play() after `didJustFinish`, which is exactly why
 *     the bug existed there. Verified on an Android emulator (Expo Go dev
 *     build of fix/lesson-player-polish), 24 Sep 2026: from 0:10/0:10, play
 *     restarted from 0.
 *     Plays the ~12s synthetic clip to its real end rather than seeking
 *     there directly — seeking was tried first and rejected: confirmed
 *     live that the seek slider's onSlidingComplete does reach
 *     LessonScreen's handleSeekChange with the right value, but `await
 *     video.current.setPositionAsync(val)` (which the elapsed-label update
 *     is sequenced after in that handler) never resolved within 20s for
 *     either test media file tried, so the elapsed label never moved. Once
 *     the clip legitimately reaches its duration, presses Play again (after
 *     waking VideoControl's auto-hiding controller bar — see
 *     wakeLessonVideoController's own header comment, an unrelated
 *     pre-existing behaviour this test has to work around, not part of this
 *     branch's fix) and asserts the elapsed label drops back near 0:00 and
 *     keeps advancing (not stuck). Waits are derived from the clip's own
 *     duration label rather than hardcoded, so this doesn't silently break
 *     if the local media file's length ever changes.
 *
 *  c) 'resume prompt renders in the active language, not hardcoded English'
 *     — guards ResumeVideoPopUp.tsx's i18n (t('resumeVideo.question'),
 *     t('button.no'), t('button.yes')) replacing the old hardcoded English
 *     JSX text in a Khmer-default UI. Triggers a real resume prompt by
 *     playing past LessonScreen.tsx's own 5s save floor
 *     (handleSaveProgressAndClear: `if (currentProgress < 5000 ...) return`)
 *     with a couple of seconds of real margin, then leaving the screen via
 *     the close button, which unmounts LessonScreen and runs its cleanup
 *     (saveProgress on unmount, not on pause — confirmed by reading
 *     LessonScreen.tsx directly). Reopening the same learning item remounts
 *     it with `learningResource.studentlearningprogress.progress >= 5000`,
 *     which `handleResumeProgress` uses to show the popup. Confirmed live
 *     this entire flow against the running dev build: after playing ~8s and
 *     closing/reopening, the popup rendered exactly
 *     "តើអ្នកចង់បន្តពីកន្លែងដែលបានឈប់លើកមុនទេ?" with "ទេ"/"បាទ/ចាស" buttons
 *     (km.json's resumeVideo.question/button.no/button.yes verbatim), not
 *     the old hardcoded "Would you like to resume from your previous
 *     session?"/"No"/"Yes". Mutation lever: reverting ResumeVideoPopUp.tsx's
 *     three `t(...)` calls to their old hardcoded English strings — RED
 *     (24 Sep 2026), at the direct `await expect(prompt).toBeVisible()`
 *     assertion below (the Khmer question text never appears, since the
 *     mutation makes the component render the English string instead).
 *     Run with a clean account/item (no >=5s saved progress yet when this
 *     test's own `openFreshDcrsLessonVideo(page)` call runs at the top of
 *     the test), so that call's own dismissResumePromptIfShowing found
 *     nothing to dismiss and the mutation was caught here, by this test's
 *     own assertions, rather than by that helper's earlier English-prompt
 *     check (see dismissResumePromptIfShowing's own header comment for the
 *     other path: with existing saved progress, THAT check fails first,
 *     before this test's body even starts) — restore with `git checkout
 *     -- src/screens/Lesson/components/ResumeVideoPopUp.tsx` afterwards.
 *     The target play time is derived from the clip's own duration label
 *     (5s floor + 2s margin, capped below the clip's own end) rather than
 *     a fixed number — a clip shorter than that (floor + margin) can't
 *     prove this at all, so the test skips itself with a stated reason
 *     instead of hanging or failing for the wrong cause.
 *
 *  d) 'desktop keeps the volume slider on the transport row, not stacked'
 *     — the wide-layout counterpart to phone-lesson-player.spec.ts's
 *     compact-layout test: at 1280px (well above VideoControl.tsx's
 *     543px `compactVolumeThreshold`), the volume slider must stay on the
 *     SAME row as the transport buttons (rewind/play/forward), not drop to
 *     its own row below the seek bar. Confirmed live at 1280x800: rewind
 *     button box {x: 580.5, y: 652, w: 55, h: 55} (spanning y 652-707),
 *     volume slider box {x: 392, y: 659.5, w: 100, h: 40} — its vertical
 *     centre (679.5) falls inside the rewind button's own y-span.
 *     Mutation-proved: hardcoding VideoControl.tsx's `isCompact` to `true`
 *     turns this red — the volume slider drops to its own row below the
 *     seek bar even at 1280px, well outside the rewind button's y-span.
 *     Restored with `git checkout --
 *     src/screens/Lesson/components/VideoControl.tsx` afterwards.
 */
import { test, expect, Page } from "@playwright/test";
import {
  CORPORATE_STUDENT,
  PLAYER_KM,
  RESUME_KM,
  loginViaExpoUi,
  openFreshDcrsLessonVideo,
  readLessonDurationLabel,
  readLessonElapsedLabel,
  wakeLessonVideoController,
} from "./fixtures";

test.describe.configure({ mode: "serial" });

/** "m:ss" (msToDuration's own format, e.g. "0:03", "1:02") -> whole seconds. */
function labelToSeconds(label: string): number {
  const [minutes, seconds] = label.split(":").map(Number);
  return minutes * 60 + seconds;
}

test.describe("expo web lesson player polish (corporate / DCRS)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("elapsed label advances during playback", async () => {
    await openFreshDcrsLessonVideo(page);

    expect(await readLessonElapsedLabel(page)).toBe("0:00");

    await page.getByRole("button", { name: PLAYER_KM.play }).click();

    await expect
      .poll(() => readLessonElapsedLabel(page), {
        timeout: 2_500,
        intervals: [250],
      })
      .not.toBe("0:00");
  });

  test("play after the end restarts playback (web regression coverage)", async () => {
    await openFreshDcrsLessonVideo(page);

    const durationLabel = await readLessonDurationLabel(page);
    expect(durationLabel).toMatch(/^\d+:\d\d$/);
    const durationSeconds = labelToSeconds(durationLabel);

    // Budget derived from the clip's own duration (real-time playback to
    // the end, plus slack for the wake-controller dance and the two
    // post-replay polls below) rather than a fixed number, so this doesn't
    // silently go too tight — or needlessly stay too long — if the local
    // media file's length ever changes. Floor of 45s for a very short clip.
    test.setTimeout(Math.max(45_000, (durationSeconds + 40) * 1000));

    // Let the clip actually finish. Seeking directly to the end via the
    // slider was tried and rejected: confirmed live that
    // RCTSliderNativeComponent.web's onSlidingComplete DOES fire and DOES
    // call LessonScreen's handleSeekChange with the right value (visible in
    // the app's own `console.log('VAL? ', val)`), but `await
    // video.current.setPositionAsync(val)` — which the elapsed label update
    // is sequenced after — never resolved for this source file within 20s
    // in this environment, so the elapsed label never moved off "0:00" no
    // matter how long the test waited. Playing the clip for real avoids
    // that seek path entirely.
    await page.getByRole("button", { name: PLAYER_KM.play }).click();

    // >= duration - 1, not exact equality: msToDuration rounds to whole
    // seconds, so the label can read one second short of the fixed
    // duration text depending on exactly which 1s tick the poll lands on.
    await expect
      .poll(async () => labelToSeconds(await readLessonElapsedLabel(page)), {
        timeout: (durationSeconds + 8) * 1000,
        intervals: [500],
      })
      .toBeGreaterThanOrEqual(durationSeconds - 1);

    // VideoControl.tsx's controller bar auto-hides and disables itself
    // shortly after playback starts (hideController, unrelated to this
    // branch's fix) and never re-shows on its own when the clip ends —
    // confirmed live. Clicking elsewhere on the player wakes it back up so
    // the Play button is clickable again; see wakeLessonVideoController's
    // own header comment for how this was confirmed.
    await wakeLessonVideoController(page);

    await page.getByRole("button", { name: PLAYER_KM.play }).click();

    // Position drops back near 0:00 (not stuck at the clip's duration). See
    // this test's header comment (b) for the scope caveat: on the web
    // build this doesn't distinguish the fixed replayAsync() branch from
    // the old playAsync()-always code (Chromium restarts .play() after
    // 'ended' either way), so what this specifically guards is narrower —
    // that the NEW replayAsync() branch doesn't itself break web playback
    // now that handlePlay takes it at end-of-clip. Mutation lever for
    // that: an early `return;` at the top of the replayAsync() branch,
    // before the `await` — RED (24 Sep 2026).
    await expect
      .poll(async () => labelToSeconds(await readLessonElapsedLabel(page)), {
        timeout: 3_000,
        intervals: [250],
      })
      .toBeLessThanOrEqual(3);

    // ...and keeps advancing, not just resetting once and stalling — same
    // scope caveat as above: coverage that replay-then-play works on web,
    // not a replayAsync()-vs-playAsync() distinction.
    const justAfterReplay = labelToSeconds(await readLessonElapsedLabel(page));
    await expect
      .poll(async () => labelToSeconds(await readLessonElapsedLabel(page)), {
        timeout: 3_000,
        intervals: [250],
      })
      .toBeGreaterThan(justAfterReplay);
  });

  test("resume prompt renders in the active language, not hardcoded English", async () => {
    await openFreshDcrsLessonVideo(page);

    const durationLabel = await readLessonDurationLabel(page);
    expect(durationLabel).toMatch(/^\d+:\d\d$/);
    const durationSeconds = labelToSeconds(durationLabel);

    // LessonScreen.tsx's handleSaveProgressAndClear only saves progress on
    // unmount when positionMillis >= 5000 — need to play past that floor
    // with real margin (poll granularity can undershoot a bare 5s), but
    // not past the clip's own end. A clip too short to allow both at once
    // can't prove this at all; skip with a stated reason instead of hanging
    // or failing for the wrong cause.
    const SAVE_FLOOR_SECONDS = 5;
    const MARGIN_SECONDS = 3;
    test.skip(
      durationSeconds < SAVE_FLOOR_SECONDS + MARGIN_SECONDS,
      `clip is only ${durationLabel} long; need at least ${
        SAVE_FLOOR_SECONDS + MARGIN_SECONDS
      }s to play past the ${SAVE_FLOOR_SECONDS}s save floor with margin`
    );
    const targetSeconds = Math.min(
      durationSeconds - 0.5,
      SAVE_FLOOR_SECONDS + MARGIN_SECONDS + 1
    );

    await page.getByRole("button", { name: PLAYER_KM.play }).click();

    await expect
      .poll(async () => labelToSeconds(await readLessonElapsedLabel(page)), {
        timeout: (targetSeconds + 5) * 1000,
        intervals: [500],
      })
      .toBeGreaterThanOrEqual(targetSeconds);

    // Leaving via the close button unmounts LessonScreen, which is when
    // progress actually saves (not on pause) — confirmed by reading
    // LessonScreen.tsx's handleSaveProgressAndClear/cleanup effect.
    await page.getByRole("button", { name: PLAYER_KM.close }).click();

    // Reopen the same learning item: a fresh mount now sees
    // studentlearningprogress.progress >= 5000, which triggers the popup.
    await page
      .getByRole("button")
      .filter({ hasText: "Animation: No plan vs clear vision" })
      .first()
      .click();

    const prompt = page.getByText(RESUME_KM.question, { exact: true });
    await expect(prompt).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(RESUME_KM.no, { exact: true })).toBeVisible();
    await expect(page.getByText(RESUME_KM.yes, { exact: true })).toBeVisible();

    // Not the old hardcoded English fallback.
    await expect(
      page.getByText("Would you like to resume from your previous session?", {
        exact: false,
      })
    ).toHaveCount(0);
    await expect(page.getByText("No", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Yes", { exact: true })).toHaveCount(0);

    // Dismiss so the shared page is in a known state for anything after.
    await page.getByText(RESUME_KM.no, { exact: true }).click();
  });

  test("desktop keeps the volume slider on the transport row, not stacked", async () => {
    await openFreshDcrsLessonVideo(page);

    const rewindButton = page.getByRole("button", { name: PLAYER_KM.rewind });
    const volumeSlider = page.getByRole("slider", { name: PLAYER_KM.volume });

    const rewindBox = await rewindButton.boundingBox();
    const volumeBox = await volumeSlider.boundingBox();
    expect(rewindBox).not.toBeNull();
    expect(volumeBox).not.toBeNull();

    const volumeCenterY = volumeBox!.y + volumeBox!.height / 2;
    expect(volumeCenterY).toBeGreaterThanOrEqual(rewindBox!.y);
    expect(volumeCenterY).toBeLessThanOrEqual(rewindBox!.y + rewindBox!.height);
  });
});
