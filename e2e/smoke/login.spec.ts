import { Page, expect, test } from '@playwright/test';
import { SUPERADMIN } from '../fixtures/accounts';
import { loginViaUi } from '../fixtures/auth';

const email = (page: Page) => page.getByLabel('Email', { exact: true });
const password = (page: Page) => page.getByLabel('Password', { exact: true });

test.describe('login', () => {
  test('superadmin can log in and lands on a dashboard', async ({ page }) => {
    await loginViaUi(page);
    await expect(page).toHaveURL(/\/dashboard\/(index|default)/);
  });

  test('bad credentials do not get in, and the form says why', async ({ page }) => {
    await page.goto('/auth');
    await email(page).fill(SUPERADMIN.username);
    await password(page).fill('Wrong_Password1');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    // The reason is announced next to the form, and only there: no toast too.
    // (A toast is an alert as well, so look inside <main>, which holds the card.)
    await expect(page.getByRole('main').getByRole('alert')).toHaveText('The email or password is incorrect.');
    // Give a toast the time it would need to appear, then look once: a retrying
    // assertion would pass after the toast faded (they last a few seconds).
    await page.waitForTimeout(750);
    expect(await page.locator('.ant-notification-notice').count(), 'no error toast').toBe(0);
    // Still on /auth: no dashboard, no token.
    await expect(page).toHaveURL(/\/auth/);
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('lms_')))).toEqual([]);
  });

  test('the sign-in page has a labelled form, a heading and no language switch', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'EdTech for Good' })).toBeVisible();
    // Staff sign in with an email (the field says so, and autofill is told which is which).
    await expect(email(page)).toHaveAttribute('autocomplete', 'username');
    await expect(password(page)).toHaveAttribute('autocomplete', 'current-password');
    // The shared auth styles (one global stylesheet, scoped under .auth-scope) apply:
    // a 52px field with radius 16.
    await expect(email(page)).toHaveCSS('height', '52px');
    await expect(email(page)).toHaveCSS('border-top-left-radius', '16px');
    await expect(page.getByText('Learners and teachers use the learning app, not this console.')).toBeVisible();
    // The admin is English-only for now.
    await expect(page.getByText('English', { exact: true })).toHaveCount(0);
    await expect(page.getByText('ភាសាខ្មែរ')).toHaveCount(0);
  });

  test('submitting an empty form asks for each field and sends nothing', async ({ page }) => {
    let signInRequests = 0;
    await page.route('**/auth/login', (route) => {
      signInRequests++;
      return route.abort();
    });
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByText('Enter your email.')).toBeVisible();
    await expect(page.getByText('Enter your password.')).toBeVisible();
    await expect(email(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(password(page)).toHaveAttribute('aria-invalid', 'true');
    // The keyboard is put on the first field that needs attention.
    await expect(email(page)).toBeFocused();
    // The button is usable again (the old form stayed "loading" after this).
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
    expect(signInRequests).toBe(0);
  });

  test('Show and Hide reveal the password, and say which state they are in', async ({ page }) => {
    await page.goto('/auth');
    await password(page).fill('Some_Password1');
    const toggle = page.getByRole('button', { name: 'Show password' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(password(page)).toHaveAttribute('type', 'password');

    await toggle.click();
    await expect(password(page)).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(password(page)).toHaveAttribute('type', 'password');
    await expect(page.getByRole('button', { name: 'Show password' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('a rate-limited sign-in says to wait', async ({ page }) => {
    // Mocked, so this does not spend the API's real sign-in budget.
    await page.route('**/auth/login', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ errormessage: 'Too many attempts.' }),
      }),
    );
    await page.goto('/auth');
    await email(page).fill(SUPERADMIN.username);
    await password(page).fill('Whatever_Pass1');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      page.getByRole('main').getByRole('alert').filter({ hasText: 'Too many sign-in attempts. Wait a minute and try again.' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/auth/);
  });

  test('sign-in works from the keyboard alone', async ({ page }) => {
    await page.goto('/auth');
    // Skip the clicks: focus the first field, then Tab and type, then Enter.
    await email(page).focus();
    await page.keyboard.type(SUPERADMIN.username);
    await page.keyboard.press('Tab');
    await expect(password(page)).toBeFocused();
    await page.keyboard.type(SUPERADMIN.password);
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/dashboard\/(index|default)/, { timeout: 15_000 });
  });

  test('Forgot password opens a dialog that asks for an email', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // The dialog renders in an overlay outside the layout: it has the same styles.
    await expect(dialog.getByLabel('Email', { exact: true })).toHaveCSS('height', '52px');

    // Mocked: no email is sent. The request is the one the old dialog made.
    await page.route('**/auth/forgotpassword', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: true }) }),
    );
    await dialog.getByLabel('Email', { exact: true }).fill('someone@example.com');
    const sent = page.waitForRequest((r) => r.url().includes('/auth/forgotpassword'));
    await dialog.getByRole('button', { name: 'Send reset link' }).click();
    expect((await sent).postDataJSON()).toEqual({ lmsusername: 'someone@example.com' });
    await expect(dialog).toBeHidden();
  });

  test('the change-password page uses the same layout', async ({ page }) => {
    // Signed out, as the emailed link is opened. The token check is mocked (a real
    // token would be a real account's reset link), and nothing is submitted.
    await page.route('**/auth/token/validate/changepassword*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: true }) }),
    );
    await page.goto('/auth/changepassword/not-a-real-token');
    await expect(page.getByRole('heading', { level: 1, name: 'Change password' })).toBeVisible();
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to sign in' })).toBeVisible();
    // It is the change-password page, not the sign-in page it used to be bounced to.
    await expect(page).toHaveURL(/\/auth\/changepassword\//);
    await expect(page.getByLabel('Email', { exact: true })).toHaveCount(0);
  });

  test('signed out, a reset link with an invalid token is checked by the server, then sent to sign in', async ({
    page,
  }) => {
    // Real API, real (invalid) token: the page used to be bounced to /auth/login
    // before it could ask the server anything.
    const checked = page.waitForRequest((r) => r.url().includes('/auth/token/validate/changepassword'));
    await page.goto('/auth/changepassword/not-a-real-token');
    await checked;
    await expect(page.locator('.ant-notification-notice')).toContainText('Invalid link');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('signed out, a verify link reaches the verify page and asks the server', async ({ page }) => {
    const asked = page.waitForRequest((r) => r.url().includes('/auth/verify?verifyemailtoken='));
    await page.goto('/auth/verify/not-a-real-token');
    await asked;
    await expect(page).toHaveURL(/\/auth\/verify\//);
  });

  test('signed out, an ordinary protected page still goes to the sign-in page', async ({ page }) => {
    await page.goto('/question/index');
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  });

  test('the sidebar renders after login', async ({ page }) => {
    // Regression guard for the change-detection loop fixed in 5193413:
    // sidebarPerm() returned a fresh array per call and the template calls it 38
    // times through *ngxPermissionsOnly, so every cycle scheduled another one.
    // It presented as a silently wedged tab, which is exactly the failure a
    // smoke suite exists to catch.
    //
    // Assert on a permission-gated link (Questions needs view_question), not Home:
    // Home is always rendered, whereas the gated items are the ones the loop
    // starves of a settled permission check.
    await loginViaUi(page);
    await expect(
      page.locator('nav[aria-label="Main"]').getByRole('link', { name: 'Questions', exact: true }),
    ).toBeVisible();

    // A wedged tab still answers a click; it just never settles. Assert the app
    // is responsive rather than merely painted.
    const before = page.url();
    await page.goto('/curriculum');
    await expect(page).not.toHaveURL(before);
  });
});
