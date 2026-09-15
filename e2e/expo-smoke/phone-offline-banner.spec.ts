/**
 * Phone offline banner regression test — targets edtech-expo branch
 * feat/offline-banner-connectivity, which renders the offline banner via an
 * OfflineBannerFrame wrapper pinned directly under each corporate learner
 * route's navigation header (subjects, courses, units, levels, lessons,
 * practice, quiz, result, profile), gated on the corporate theme
 * (useDesign().isCorporate). The kids theme mounts nothing. Only meaningful
 * at phone width: run exclusively by the `phone` project (390x844) in
 * playwright.expo.config.ts, which the `chromium` (1280x800) project
 * explicitly ignores.
 *
 * What each test guards:
 *
 *  a) 'corporate phone shell shows the offline banner when the network drops
 *     and hides it when it returns' — guards that the offline banner renders
 *     as a react-native-web component with testID="offline-banner" inside the
 *     corporate Home (subjects) screen's OfflineBannerFrame wrapper, animates
 *     from 0px bounding box height when online to >=36px (BANNER_HEIGHT) when
 *     setOffline(true), displays the correct Khmer copy, and animates back to
 *     0px when the network returns. The wrapper's inner role="alert" content
 *     stays in the DOM in both states, clipped by overflow:hidden, so
 *     toBeVisible() on the text is unreliable — the test polls the WRAPPER's
 *     bounding box height instead. Mutation proof: stubbing the connectivity
 *     hook to always return isOffline: false, or dropping OfflineBannerFrame
 *     from the subjects route, turns the ">= 36 after setOffline(true)"
 *     assertion red.
 *
 *  b) 'kids theme never mounts the offline banner, even offline' — guards
 *     that the offline banner is rendered ONLY for the corporate theme
 *     (useDesign().isCorporate returns true), and is NEVER rendered for the
 *     kids theme. The banner locator count must be 0 whether online or
 *     offline. Also asserts the kids theme's Drawer is actually present (via
 *     the hardcoded "Close drawer" label from @react-navigation/drawer's
 *     Overlay component) to prove we are really on the kids shell. Test 2 uses
 *     its own fresh context because the kids Drawer is closed by default at
 *     phone width (only corporate's rail is permanent), making any
 *     Drawer-mounted logout control unreachable; no logout attempt means no
 *     test interference at phone width, and the rpi API's one-token-per-user
 *     rule evicts the prior token on the next login anyway, so explicit
 *     cleanup is unnecessary.
 */
import { test, expect, Page, BrowserContext } from "@playwright/test";
import {
  CORPORATE_STUDENT,
  KIDS_STUDENT,
  loginViaExpoUi,
} from "./fixtures";

test.describe.configure({ mode: "serial" });

/**
 * Offline banner copy in Khmer — copied verbatim from
 * edtech-expo/src/locales/km.json key `offline.banner`. Never hand-typed.
 */
const OFFLINE_BANNER_KM =
  "អ្នកកំពុងនៅក្រៅបណ្ដាញ។ មេរៀនដែលបានទាញយកនៅតែអាចប្រើបាន។";

test.describe("expo web offline banner (phone)", () => {
  let corporateContext: BrowserContext;
  let corporatePage: Page;
  let kidsContext: BrowserContext;
  let kidsPage: Page;

  test.beforeAll(async ({ browser }) => {
    // Corporate shell test context.
    corporateContext = await browser.newContext();
    corporatePage = await corporateContext.newPage();
    await loginViaExpoUi(
      corporatePage,
      CORPORATE_STUDENT.username,
      CORPORATE_STUDENT.password
    );

    // Kids shell test context.
    kidsContext = await browser.newContext();
    kidsPage = await kidsContext.newPage();
    await loginViaExpoUi(
      kidsPage,
      KIDS_STUDENT.username,
      KIDS_STUDENT.password
    );
  });

  test.afterEach(async () => {
    // Network restore guarantee: if a test throws between setOffline(true)
    // and setOffline(false), both contexts stay offline and the next test's
    // page.goto('/') inside loginViaExpoUi navigates offline. Restore both
    // contexts explicitly, even if the current test's own setOffline(false)
    // already ran. The .catch() suppresses harmless errors if a context is
    // already closed.
    await corporateContext.setOffline(false).catch(() => {});
    await kidsContext.setOffline(false).catch(() => {});
  });

  test.afterAll(async () => {
    await corporateContext.close();
    await kidsContext.close();
  });

  test("corporate phone shell shows the offline banner when the network drops and hides it when it returns", async () => {
    // Verify we are in the corporate phone shell (Tabs, not rail or drawer).
    await expect(corporatePage.locator('[data-testid="tab-home"]')).toBeVisible();

    const banner = corporatePage.locator('[data-testid="offline-banner"]');

    // Confirm the banner wrapper is in the DOM. Count is 1 because only the
    // subjects screen is mounted on Home; deeper in the stack each mounted
    // screen carries its own banner, so a count assertion elsewhere would
    // need .first().
    await expect(banner).toHaveCount(1);

    // Precondition: banner should animate to 0px height when online
    // (wrapper's overflow:hidden clips the inner alert content).
    await expect
      .poll(async () => (await banner.boundingBox())?.height ?? -1)
      .toBe(0);

    // Go offline — the banner wrapper should animate to 36px (BANNER_HEIGHT).
    await corporateContext.setOffline(true);
    await expect
      .poll(
        async () => (await banner.boundingBox())?.height ?? -1,
        { timeout: 5000 }
      )
      .toBeGreaterThanOrEqual(36);

    // Verify the banner's inner alert text is present and correct.
    await expect(banner.getByRole("alert")).toContainText(OFFLINE_BANNER_KM);

    // Go back online — the banner wrapper should animate back to 0px.
    await corporateContext.setOffline(false);
    await expect
      .poll(
        async () => (await banner.boundingBox())?.height ?? -1,
        { timeout: 5000 }
      )
      .toBe(0);
  });

  test("kids theme never mounts the offline banner, even offline", async () => {
    // Verify we are in the kids theme (Drawer shell) by asserting the
    // hardcoded "Close drawer" label from @react-navigation/drawer's Overlay
    // — this label only exists in the DOM when a Drawer navigator is mounted.
    await expect(
      kidsPage.getByLabel("Close drawer", { exact: true })
    ).toBeAttached();

    // Verify the offline banner is not mounted (count 0).
    await expect(kidsPage.locator('[data-testid="offline-banner"]')).toHaveCount(0);

    // Go offline and wait for any potential async mounts.
    await kidsContext.setOffline(true);
    await kidsPage.waitForTimeout(500);

    // Banner should still not be mounted.
    await expect(kidsPage.locator('[data-testid="offline-banner"]')).toHaveCount(0);

    // Go back online.
    await kidsContext.setOffline(false);
  });
});
