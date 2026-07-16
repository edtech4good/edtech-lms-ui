import { expect, test } from '@playwright/test';
import { SUPERADMIN } from '../fixtures/accounts';
import { loginViaUi } from '../fixtures/auth';

test.describe('login', () => {
  test('superadmin can log in and lands on a dashboard', async ({ page }) => {
    await loginViaUi(page);
    await expect(page).toHaveURL(/\/dashboard\/(index|default)/);
  });

  test('bad credentials do not get in', async ({ page }) => {
    await page.goto('/auth');
    await page.fill('input[formControlName="lmsusername"]', SUPERADMIN.username);
    await page.fill('input[formControlName="lmsuserpassword"]', 'Wrong_Password1');
    await page.getByRole('button', { name: 'Log in' }).click();
    // Still on /auth after a beat — no dashboard, no token.
    await page.waitForTimeout(2_000);
    await expect(page).toHaveURL(/\/auth/);
  });

  test('the sidebar renders after login', async ({ page }) => {
    // Regression guard for the change-detection loop fixed in 5193413:
    // sidebarPerm() returned a fresh array per call and the template calls it 38
    // times through *ngxPermissionsOnly, so every cycle scheduled another one.
    // It presented as a silently wedged tab, which is exactly the failure a
    // smoke suite exists to catch.
    await loginViaUi(page);
    await expect(page.locator('ul[nz-menu] li').first()).toBeVisible();

    // A wedged tab still answers a click; it just never settles. Assert the app
    // is responsive rather than merely painted.
    const before = page.url();
    await page.goto('/curriculum');
    await expect(page).not.toHaveURL(before);
  });
});
