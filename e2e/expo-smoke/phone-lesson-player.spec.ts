/**
 * Phone lesson player (corporate / DCRS) — catches a regression in
 * VideoControl.tsx's compact layout (edtech-expo, branch
 * fix/lesson-player-polish, commit 06aaabe). Only meaningful at phone
 * width: run exclusively by the `phone` project (390x844) in
 * playwright.expo.config.ts, which the `chromium` (1280x800) project
 * explicitly ignores (see that config's own header comment on
 * phone-*.spec.ts).
 *
 * What this guards: below `compactVolumeThreshold` (543 with the current
 * button/slider sizes — a 390dp phone is comfortably under that, a 720
 * tablet/desktop stays wide), the controller must stack transport buttons,
 * then the seek row, then the volume row — NOT the wide layout's single row
 * with the volume slider to the left of the transport buttons, which on a
 * phone squeezed the slider to ~89px and drew it behind the rewind button
 * (the bug this commit fixes; see LessonScreen's handoff commit message and
 * VideoControl.tsx's own `compactVolumeThreshold` comment for the exact
 * arithmetic).
 *
 * Confirmed live at 390x844 (miv.verify / DCRS lesson 1's learning item):
 * rewind button box {x: 91.5, y: 595, w: 55, h: 55} (bottom edge 650), seek
 * slider box {x: 68.25, y: 655, w: 254, h: 40}, volume slider box
 * {x: 123.5, y: 707, w: 195, h: 40} — volume sits well below both the
 * rewind button and the seek row, no overlap in either axis.
 *
 * Mutation-proved: hardcoding VideoControl.tsx's `isCompact` to `false`
 * (see this repo's PR description / handoff notes for the exact edit)
 * reverts to the wide one-row layout even at 390px — the volume slider
 * renders beside the transport buttons at roughly the same y as the rewind
 * button, and both assertions below go red: the overlap check trips (volume
 * box significantly intersects the rewind box) and the "below the seek row"
 * check fails (volume.y ends up well above seek.y, not below it). Restored
 * with `git checkout -- src/screens/Lesson/components/VideoControl.tsx` in
 * the edtech-expo worktree afterwards.
 */
import { test, expect, Page } from "@playwright/test";
import {
  CORPORATE_STUDENT,
  PLAYER_KM,
  loginViaExpoUi,
  openFreshDcrsLessonVideo,
} from "./fixtures";

test.describe.configure({ mode: "serial" });

test.describe("expo web phone lesson player (corporate / DCRS)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("volume slider stacks below the seek row, clear of the rewind button", async () => {
    await openFreshDcrsLessonVideo(page);

    const rewindButton = page.getByRole("button", { name: PLAYER_KM.rewind });
    const seekSlider = page.getByRole("slider", { name: PLAYER_KM.seek });
    const volumeSlider = page.getByRole("slider", { name: PLAYER_KM.volume });

    const rewindBox = await rewindButton.boundingBox();
    const seekBox = await seekSlider.boundingBox();
    const volumeBox = await volumeSlider.boundingBox();
    expect(rewindBox).not.toBeNull();
    expect(seekBox).not.toBeNull();
    expect(volumeBox).not.toBeNull();

    // No overlap on either axis between the volume slider and the rewind
    // button — the exact bug this commit fixes (slider squeezed to ~89px
    // and drawn behind the rewind button in the old one-row layout).
    const overlapsRewind = !(
      volumeBox!.x + volumeBox!.width <= rewindBox!.x ||
      rewindBox!.x + rewindBox!.width <= volumeBox!.x ||
      volumeBox!.y + volumeBox!.height <= rewindBox!.y ||
      rewindBox!.y + rewindBox!.height <= volumeBox!.y
    );
    expect(overlapsRewind).toBe(false);

    // Stacked order: volume row renders below the seek row (confirmed live
    // values in the header comment — 707 vs 655).
    expect(volumeBox!.y).toBeGreaterThan(seekBox!.y + seekBox!.height - 1);
  });
});
