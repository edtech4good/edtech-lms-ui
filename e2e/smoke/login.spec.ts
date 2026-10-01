import { Page, expect, test } from '@playwright/test';
import { SUPERADMIN } from '../fixtures/accounts';
import { loginViaUi } from '../fixtures/auth';

const email = (page: Page) => page.getByLabel('Email', { exact: true });
const password = (page: Page) => page.getByLabel('Password', { exact: true });
const signInButton = (page: Page) => page.getByRole('button', { name: 'Sign in', exact: true });
/** The form's own alert. (A toast is an alert too, so look inside <main>, which holds the card.) */
const formAlert = (page: Page) => page.getByRole('main').getByRole('alert');
const toasts = (page: Page) => page.locator('.ant-notification-notice');
/**
 * Give a toast the time it would need to appear, then look once. A retrying
 * assertion would pass after the toast faded (they last a few seconds).
 */
async function expectNoToast(page: Page): Promise<void> {
  await page.waitForTimeout(750);
  expect(await toasts(page).count(), 'no error toast').toBe(0);
}

test.describe('login', () => {
  test('superadmin can log in and lands on a dashboard', async ({ page }) => {
    await loginViaUi(page);
    await expect(page).toHaveURL(/\/dashboard\/(index|default)/);
  });

  test('bad credentials do not get in, and the form says why', async ({ page }) => {
    await page.goto('/auth');
    await email(page).fill(SUPERADMIN.username);
    await password(page).fill('Wrong_Password1');
    await signInButton(page).click();
    // The reason is announced next to the form, and only there: no toast too.
    await expect(formAlert(page)).toHaveText('The email or password is incorrect.');
    await expectNoToast(page);
    // The next thing to do is retype the password: focus is there, not lost to the page.
    await expect(password(page)).toBeFocused();
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
    // The label says what pressing it does, and changes: no pressed state on top of it.
    const toggle = page.getByRole('button', { name: 'Show password' });
    await expect(toggle).not.toHaveAttribute('aria-pressed');
    await expect(password(page)).toHaveAttribute('type', 'password');

    await toggle.click();
    await expect(password(page)).toHaveAttribute('type', 'text');
    const hide = page.getByRole('button', { name: 'Hide password' });
    await expect(hide).not.toHaveAttribute('aria-pressed');

    await hide.click();
    await expect(password(page)).toHaveAttribute('type', 'password');
    await expect(page.getByRole('button', { name: 'Show password' })).toBeVisible();
  });

  /** Submit the form against a mocked sign-in answer, and look at what the page does. */
  async function failSignIn(page: Page, answer: { status: number } | 'abort'): Promise<void> {
    // Mocked, so this does not spend the API's real sign-in budget.
    await page.route('**/auth/login', (route) =>
      answer === 'abort'
        ? route.abort('connectionrefused')
        : route.fulfill({
            status: answer.status,
            contentType: 'application/json',
            body: JSON.stringify({ errormessage: 'Mocked.' }),
          }),
    );
    await page.goto('/auth');
    await email(page).fill(SUPERADMIN.username);
    await password(page).fill('Whatever_Pass1');
    await signInButton(page).click();
  }

  test('a rate-limited sign-in says to wait, in the form and nowhere else', async ({ page }) => {
    await failSignIn(page, { status: 429 });
    await expect(formAlert(page)).toHaveText('Too many sign-in attempts. Wait a minute and try again.');
    await expectNoToast(page);
    await expect(page).toHaveURL(/\/auth/);
    // Nothing to retype: Sign in is where focus goes, enabled again.
    await expect(signInButton(page)).toBeFocused();
  });

  // The form owns every sign-in failure: one message, beside the form, no toast.
  for (const status of [401, 403, 404, 500, 502, 503]) {
    test(`a sign-in answered with HTTP ${status} says it is not available, in the form and nowhere else`, async ({
      page,
    }) => {
      await failSignIn(page, { status });
      await expect(formAlert(page)).toHaveText("Sign-in isn't available right now. Try again in a moment.");
      await expectNoToast(page);
      await expect(page).toHaveURL(/\/auth\/login/);
      await expect(signInButton(page)).toBeFocused();
      await expect(signInButton(page)).toBeEnabled();
      expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('lms_')))).toEqual([]);
    });
  }

  test('a sign-in that gets no answer says the server cannot be reached, in the form and nowhere else', async ({
    page,
  }) => {
    await failSignIn(page, 'abort');
    await expect(formAlert(page)).toHaveText("Can't reach the server. Check your connection and try again.");
    await expectNoToast(page);
    await expect(signInButton(page)).toBeFocused();
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

  const TOKEN = 'tok-7f3a9c2e';
  /**
   * Open the change-password page signed out, as the emailed link is. The token
   * check and the password change are mocked (a real token would be a real
   * account's reset link, and nothing may change a real password). Returns the
   * PUTs the page sent.
   */
  async function openChangePassword(
    page: Page,
    opts: { putStatus?: number | 'abort'; putDelayMs?: number; putMessage?: string } = {},
  ): Promise<string[]> {
    const { putStatus = 200, putDelayMs = 0, putMessage = 'Mocked.' } = opts;
    const puts: string[] = [];
    await page.route('**/auth/token/validate/changepassword*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: true }) }),
    );
    await page.route('**/auth/changepassword?*', async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      puts.push(route.request().url());
      if (putDelayMs) await new Promise((r) => setTimeout(r, putDelayMs));
      if (putStatus === 'abort') return route.abort('connectionrefused');
      return route.fulfill({
        status: putStatus,
        contentType: 'application/json',
        body: JSON.stringify({ data: putStatus === 200, errormessage: putMessage }),
      });
    });
    await page.goto(`/auth/changepassword/${TOKEN}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Change password' })).toBeVisible();
    return puts;
  }
  const newPassword = (page: Page) => page.getByLabel('New password', { exact: true });
  const confirmPassword = (page: Page) => page.getByLabel('Confirm password', { exact: true });

  test('the change-password page uses the same layout', async ({ page }) => {
    await openChangePassword(page);
    await expect(newPassword(page)).toBeVisible();
    await expect(confirmPassword(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change password' })).toBeVisible();
    // "Back to sign in" goes somewhere, so it is a link, styled as the secondary button.
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/auth/login');
    // It is the change-password page, not the sign-in page it used to be bounced to.
    await expect(page).toHaveURL(/\/auth\/changepassword\//);
    await expect(email(page)).toHaveCount(0);
  });

  test('"Back to sign in" goes to the sign-in page', async ({ page }) => {
    await openChangePassword(page);
    await page.getByRole('link', { name: 'Back to sign in' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('two different passwords send nothing and say so beside the Confirm field', async ({ page }) => {
    const puts = await openChangePassword(page);
    await newPassword(page).fill('First_Password1');
    await confirmPassword(page).fill('Second_Password1');
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(formAlert(page)).toHaveText("The passwords don't match.");
    await expect(confirmPassword(page)).toHaveAttribute('aria-invalid', 'true');
    const described = await confirmPassword(page).getAttribute('aria-describedby');
    expect(described, 'the Confirm field points at its message').toBeTruthy();
    await expect(page.locator(`#${described}`)).toHaveText("The passwords don't match.");
    await expect(confirmPassword(page)).toBeFocused();
    // Look once, after a pause: a request would have gone by now. And no toast.
    await expectNoToast(page);
    expect(puts, 'no password change was sent').toEqual([]);
    await expect(page).toHaveURL(/\/auth\/changepassword\//);

    // Typing again clears the message.
    await confirmPassword(page).fill('First_Password1');
    await expect(formAlert(page)).toHaveCount(0);
  });

  test('matching passwords send one change, then go to sign-in with a message', async ({ page }) => {
    const puts = await openChangePassword(page);
    await newPassword(page).fill('Same_Password1');
    await confirmPassword(page).fill('Same_Password1');
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(toasts(page)).toContainText('Password updated. Sign in with your new password.');
    expect(puts.length, 'one password change was sent').toBe(1);
  });

  test('a password change the API refuses as an invalid link says so and goes to sign-in', async ({ page }) => {
    await openChangePassword(page, { putStatus: 401 });
    await newPassword(page).fill('Same_Password1');
    await confirmPassword(page).fill('Same_Password1');
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(toasts(page)).toContainText('This link is invalid or has expired.');
  });

  async function submitMatching(page: Page): Promise<void> {
    await newPassword(page).fill('Same_Password1');
    await confirmPassword(page).fill('Same_Password1');
  }
  const changeButton = (page: Page) => page.getByRole('button', { name: 'Change password' });

  test('a double-click sends one change and shows one message', async ({ page }) => {
    const puts = await openChangePassword(page, { putDelayMs: 800 });
    await submitMatching(page);
    await changeButton(page).dblclick();
    await expect(page).toHaveURL(/\/auth\/login/);
    await page.waitForTimeout(750);
    expect(puts.length, 'one password change was sent').toBe(1);
    expect(await toasts(page).count(), 'one message').toBe(1);
  });

  test('Enter twice while it loads sends one change', async ({ page }) => {
    const puts = await openChangePassword(page, { putDelayMs: 800 });
    await submitMatching(page);
    await confirmPassword(page).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/auth\/login/);
    await page.waitForTimeout(750);
    expect(puts.length, 'one password change was sent').toBe(1);
    expect(await toasts(page).count(), 'one message').toBe(1);
  });

  test('a refused change shows the API\'s message once, and the form can be submitted again', async ({ page }) => {
    const puts = await openChangePassword(page, { putStatus: 400, putMessage: 'Mocked reset refusal.' });
    await submitMatching(page);
    await changeButton(page).click();
    // The interceptor still toasts a 400 from every other auth request.
    await expect(toasts(page)).toContainText('Mocked reset refusal.');
    expect(await toasts(page).count(), 'one message').toBe(1);
    // The form stays, and the button is usable again, with focus on it.
    await expect(changeButton(page)).toBeEnabled();
    await expect(changeButton(page)).toBeFocused();
    await changeButton(page).click();
    await expect.poll(() => puts.length, 'a second submit sends a second change').toBe(2);
    await expect(page).toHaveURL(/\/auth\/changepassword\//);
  });

  for (const putStatus of [500, 'abort'] as const) {
    test(`a change that fails (${putStatus}) leaves the form usable`, async ({ page }) => {
      const puts = await openChangePassword(page, { putStatus });
      await submitMatching(page);
      await changeButton(page).click();
      await expect(toasts(page)).toHaveCount(1);
      await expect(changeButton(page)).toBeEnabled();
      await expect(changeButton(page)).toBeFocused();
      await changeButton(page).click();
      await expect.poll(() => puts.length).toBe(2);
    });
  }

  for (const failure of [500, 'abort'] as const) {
    test(`a token check that fails (${failure}) ends at sign-in with the interceptor's one message, and logs no token`, async ({
      page,
    }) => {
      const logged: string[] = [];
      page.on('console', (m) => logged.push(m.text()));
      page.on('pageerror', (e) => logged.push(`${e.message}\n${e.stack ?? ''}`));
      await page.route('**/auth/token/validate/changepassword*', (route) =>
        failure === 'abort'
          ? route.abort('connectionrefused')
          : route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ errormessage: 'Mocked.' }),
            }),
      );
      await page.goto(`/auth/changepassword/${TOKEN}`);
      await expect(page).toHaveURL(/\/auth\/login/);
      await expect(toasts(page)).toHaveCount(1);
      await page.waitForTimeout(750);
      expect(await toasts(page).count(), 'one message, not two').toBe(1);
      expect(logged.filter((l) => l.includes(TOKEN)), 'nothing logged contains the token').toEqual([]);
    });
  }

  test('other auth requests still toast: the forgot-password rate limit', async ({ page }) => {
    await page.route('**/auth/forgotpassword', (route) =>
      route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ errormessage: 'Mocked.' }) }),
    );
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Email', { exact: true }).fill('someone@example.com');
    await dialog.getByRole('button', { name: 'Send reset link' }).click();
    await expect(toasts(page)).toContainText('Too many attempts. Wait a minute and try again.');
    expect(await toasts(page).count(), 'one message').toBe(1);
  });

  test('a verified email says to sign in', async ({ page }) => {
    await page.route('**/auth/verify?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: true }) }),
    );
    await page.goto(`/auth/verify/${TOKEN}`);
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(toasts(page)).toContainText('Email verified. Sign in to continue.');
  });

  test('signed out, a reset link with an invalid token is checked by the server, then sent to sign in', async ({
    page,
  }) => {
    // Real API, real (invalid) token: the page used to be bounced to /auth/login
    // before it could ask the server anything.
    const checked = page.waitForRequest((r) => r.url().includes('/auth/token/validate/changepassword'));
    await page.goto('/auth/changepassword/not-a-real-token');
    await checked;
    await expect(toasts(page)).toContainText('This link is invalid or has expired.');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('signed out, a verify link with an invalid token says so and goes to sign in', async ({ page }) => {
    // Real API, real (invalid) token. The page used to stay blank.
    const asked = page.waitForRequest((r) => r.url().includes('/auth/verify?verifyemailtoken='));
    await page.goto('/auth/verify/not-a-real-token');
    await asked;
    await expect(toasts(page)).toContainText('This link is invalid or has expired.');
    await expect(page).toHaveURL(/\/auth\/login/);
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
