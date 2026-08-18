/**
 * Login — catches: the login form no longer submitting, wrong-password
 * handling silently letting someone through (or the app hanging instead of
 * erroring), and either UI theme's post-login home screen failing to
 * render or hydrate after a real auth round trip.
 */
import { test, expect } from '@playwright/test';
import { CORPORATE_STUDENT, KIDS_STUDENT, KM, loginViaExpoUi } from './fixtures';

test.describe('expo web login', () => {
  test('wrong password stays on login', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"]').first().fill(KIDS_STUDENT.username);
    await page.locator('input[type="password"]').first().fill('not-the-real-password');
    // Text, not role — see loginViaExpoUi's comment in fixtures.ts: whichever
    // theme this fresh context boots into, its login button may not carry
    // accessibilityRole="button".
    await page.getByText(KM.loginButton, { exact: true }).click();

    // useAuth stringifies the failed request into an error state and
    // GenericModal surfaces it — assert the modal, not just the message
    // text, since the message itself is an untranslated axios string. Text,
    // not role: the kids theme's modal footer is a FilledButton, which
    // (like its login button) never sets accessibilityRole="button".
    await expect(page.getByRole('dialog').getByText(KM.ok, { exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/\/home/);
  });

  test('kids login (demo.sophea) reaches home', async ({ page }) => {
    await loginViaExpoUi(page, KIDS_STUDENT.username, KIDS_STUDENT.password);
    await expect(page).toHaveURL(/\/home/);
    // CustomDrawer's profile header renders the real schoolusername decoded
    // from the JWT — proof this landed on a real, authenticated home screen
    // rather than some catch-all fallback route. Plain string, not a RegExp:
    // getByText already does a substring match, and 'demo.sophea' as a
    // pattern would let the dot match any character.
    await expect(page.getByText(KIDS_STUDENT.username)).toBeVisible();
  });

  test('corporate login (miv.verify) reaches home with corporate structure', async ({
    page,
  }) => {
    await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
    await expect(page).toHaveURL(/\/home/);
    // Both only render on SubjectSelectionScreen's isCorporate branch and
    // the corporate-only nav rail — kids theme has neither.
    await expect(page.getByText(KM.subjectGreeting, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: KM.logout })).toBeVisible();
  });
});
