import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../fixtures/env';

/**
 * The Add learner drawer on the Learners screen, in a browser, with every answer from the API mocked: the sign-in is a
 * token written to the session (no server is asked), and every request to the API host is answered by a route here,
 * following the contract of `GET student/username-available` and `POST student/one`. Nothing leaves the machine: any
 * other host is refused.
 *
 * Run it against a production or local build served on E2E_BASE_URL. The session keys and the API host are those of
 * that build's environment file: E2E_API_URL, and E2E_ACCESS_KEYS as "algKey,payloadKey,hashKey" (the local build's
 * keys are the defaults).
 */
const ACCESS_KEYS = (process.env.E2E_ACCESS_KEYS ?? 'lms_access_alg,lms_access_payload,lms_access_hash').split(',');
const PERMISSIONS = ['create_student', 'view_student', 'view_school', 'view_curriculum'];
const ADMIN_ROLE = 'zr5ER4QD';

const SCHOOL_A = { schoolid: 'school-a', schoolname: 'North Valley School' };
const SCHOOL_B = { schoolid: 'school-b', schoolname: 'South Hill School' };
const SCHOOL_C = { schoolid: 'school-c', schoolname: 'Empty Hill School' };
const SCHOOL_D = { schoolid: 'school-d', schoolname: 'Gone Curriculum School' };
const FIRST = 'សុខា';
const LAST = 'ចាន់';
const FULL = `${FIRST} ${LAST}`;
const CLASSES: Record<string, Array<{ standardid: string; standardname: string }>> = {
  'school-a': [
    { standardid: 'class-a1', standardname: 'Class 1A' },
    { standardid: 'class-a2', standardname: 'Class 2A' },
  ],
  'school-b': [{ standardid: 'class-b1', standardname: 'Class 9B' }],
  'school-c': [],
  'school-d': [{ standardid: 'class-d1', standardname: 'Class 4D' }],
};
const CURRICULA: Record<string, Array<{ curriculumid: string; curriculumname: string }>> = {
  'school-a': [
    { curriculumid: 'cur-1', curriculumname: 'Reading Basics' },
    { curriculumid: 'cur-2', curriculumname: 'Number Skills' },
  ],
  'school-b': [{ curriculumid: 'cur-3', curriculumname: 'Science Starters' }],
  'school-c': [],
  // The route lists a deleted curriculum without its name.
  'school-d': [{ curriculumid: 'cur-gone' } as { curriculumid: string; curriculumname: string }],
};

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function sessionToken(claims: object): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ lmsuserid: 'staff-1', lmsuserrole: ADMIN_ROLE, firstname: 'Test', lastname: 'Admin', permissions: PERMISSIONS, exp, iat: exp - 10, ...claims })}.c2ln`;
}

const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const invalid = (fields: Array<{ field: string; message: string }>) =>
  json(400, { error: true, code: 'INVALID_INPUT', errormessage: "Some of the information isn't valid.", fields });

interface Mock {
  schools: Array<typeof SCHOOL_A>;
  /** username → taken? Any other username is free. */
  taken: Set<string>;
  availabilityStatus: number;
  availabilityCalls: string[];
  /** username → milliseconds the answer is held back. */
  delays: Record<string, number>;
  createAnswer: () => ReturnType<typeof json>;
  created: Array<Record<string, unknown>>;
  listCalls: number;
  /** Publication state of a curriculum by id; any other is published. */
  publication: Record<string, string>;
  publicationReads: string[];
  /** Makes every publication read fail (the pickers then offer everything: central still refuses an unpublished one). */
  publicationFails: boolean;
  unmocked: string[];
}

function newMock(): Mock {
  return {
    schools: [SCHOOL_A, SCHOOL_B],
    taken: new Set(['takenname']),
    availabilityStatus: 200,
    availabilityCalls: [],
    delays: {},
    createAnswer: () => json(201, { schooluserid: 'su-1', schoolusername: 'sokha1', studentname: FULL, push: { status: 'pushed', message: 'ok' } }),
    created: [],
    listCalls: 0,
    publication: {},
    publicationReads: [],
    publicationFails: false,
    unmocked: [],
  };
}

async function openLearners(
  context: BrowserContext,
  mock: Mock,
  claims: object = { isplatform: false, organisationid: 'org-1' },
  clipboardWrite = true,
): Promise<Page> {
  await context.grantPermissions(clipboardWrite ? ['clipboard-read', 'clipboard-write'] : ['clipboard-read'], { origin: new URL(BASE_URL).origin }).catch(() => undefined);
  await context.addInitScript(
    ({ keys, token }) => {
      const [alg, payload, hash] = token.split('.');
      // Only a fresh tab gets the session: a reload within the test keeps what the app stored.
      if (!sessionStorage.getItem(keys[0])) {
        sessionStorage.setItem(keys[0], alg);
        sessionStorage.setItem(keys[1], payload);
        sessionStorage.setItem(keys[2], hash);
      }
    },
    { keys: ACCESS_KEYS, token: sessionToken(claims) },
  );
  // Anything that is not this app or its mocked API is refused.
  await context.route(
    (url) => url.origin !== new URL(BASE_URL).origin && url.origin !== new URL(API_URL).origin,
    (route) => route.abort(),
  );
  await context.route(`${API_URL}/**`, (route) => answer(route, mock));
  const page = await context.newPage();
  await page.goto('/student/index');
  await expect(page.getByRole('button', { name: 'Upload Users' })).toBeVisible();
  return page;
}

async function answer(route: Route, mock: Mock): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname.replace(/^\//, '');
  const method = request.method();
  if (method === 'OPTIONS') return route.fulfill({ status: 204 });
  if (method === 'GET' && path === 'student/username-available') {
    const name = url.searchParams.get('username') ?? '';
    mock.availabilityCalls.push(name);
    if (mock.availabilityStatus !== 200) return route.fulfill(json(mock.availabilityStatus, { error: true }));
    if (mock.delays[name]) await new Promise((resolve) => setTimeout(resolve, mock.delays[name]));
    // (An answer for a request the page has since cancelled has nowhere to go.)
    return route.fulfill(json(200, { available: !mock.taken.has(name) })).catch(() => undefined);
  }
  if (method === 'POST' && path === 'student/one') {
    mock.created.push(request.postDataJSON());
    return route.fulfill(mock.createAnswer());
  }
  if (method === 'POST' && path === 'school') return route.fulfill(json(200, { data: { data: mock.schools, total: mock.schools.length } }));
  if (method === 'POST' && path === 'student') {
    mock.listCalls++;
    return route.fulfill(json(200, { data: { data: [], total: 0 } }));
  }
  const standards = path.match(/^standard\/school\/(.+)$/);
  if (method === 'GET' && standards) return route.fulfill(json(200, { data: CLASSES[standards[1]] ?? [] }));
  const curricula = path.match(/^school\/(.+)\/curriculums$/);
  if (method === 'GET' && curricula) return route.fulfill(json(200, { data: CURRICULA[curricula[1]] ?? [] }));
  // Each curriculum's publication state (the pickers offer only published ones).
  const publication = /^curriculum\/publication\/([^/]+)$/.exec(path);
  if (method === 'GET' && publication) {
    mock.publicationReads.push(publication[1]);
    if (mock.publicationFails) return route.fulfill(json(500, { error: true, errormessage: 'Something broke.' }));
    return route.fulfill(json(200, { data: { publicationstatus: mock.publication[publication[1]] ?? 'published' } }));
  }
  mock.unmocked.push(`${method} ${path}`);
  return route.fulfill(json(200, { data: [] }));
}

const drawer = (page: Page) => page.getByRole('dialog', { name: /Add learner|Learner added/ });
const note = (page: Page) => page.getByTestId('username-note');
const toasts = (page: Page) => page.locator('.ant-notification-notice-description');
/** The error line inside the field that holds `selector`. */
const errorOf = (page: Page, selector: string) => page.locator('.field', { has: page.locator(selector) }).locator('.field-error');

async function choose(page: Page, nzId: string, option: string): Promise<void> {
  await page.locator(`#${nzId.replace(/-input$/, '')} .ant-select-selector`).click();
  await page.locator('.ant-select-item-option', { hasText: option }).first().click();
}

async function openDrawer(page: Page): Promise<void> {
  await page.getByTestId('add-learner').click();
  await expect(drawer(page)).toBeVisible();
  await expect(page.locator('#add-learner-first')).toBeVisible();
}

/** Fill every required field. School A has two classes and two curricula, so each is chosen. */
async function fillRequired(page: Page, username = 'sokha1', password = 'riverlamp47'): Promise<void> {
  await page.locator('#add-learner-first').fill(FIRST);
  await page.locator('#add-learner-username').fill(username);
  await page.locator('#add-learner-password').fill(password);
  await choose(page, 'add-learner-school-input', 'North Valley School');
  await choose(page, 'add-learner-class-input', 'Class 1A');
  await choose(page, 'add-learner-curricula-input', 'Reading Basics');
  await page.keyboard.press('Escape');
  await page.getByRole('radio', { name: 'Female', exact: true }).check({ force: true });
}


/** Central's two real sentences for a push that failed: the learning server did not answer, or it lacks the class or curriculum. */
const SYNC_MESSAGE = "The account was saved, but the learning server did not answer. Run Sync Students for this school on the Schools screen.";
const MISSING_MESSAGE = "Saved, but the learning server doesn't have this class or curriculum yet. Run Sync Content, then Sync Students for this school.";

test.describe('Add learner drawer', () => {
  test('opens from the Learners screen with the Account, Where and About fields and nothing for later slices', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openDrawer(page);
    const form = drawer(page);
    await expect(form.getByRole('heading', { name: 'Add learner', exact: true })).toBeVisible();
    for (const label of ['First name', 'Last name', 'Username', 'Password', 'School', 'Class', 'Curriculum', 'Date of birth']) {
      await expect(form.getByText(label, { exact: false }).first(), label).toBeVisible();
    }
    await expect(form.getByRole('radio')).toHaveCount(2);
    await expect(form.getByRole('radio', { name: 'Female', exact: true })).toBeVisible();
    await expect(form.getByRole('radio', { name: 'Male', exact: true })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Generate' })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Show' })).toBeVisible();
    const text = await form.innerText();
    for (const later of ['Profile questions', 'Washington', 'Non-binary', 'Prefer not to say', 'Teacher']) {
      expect(text, `${later} belongs to a later slice`).not.toContain(later);
    }
    // (The list's own search boxes ask `.../all`, in no fixed order; every other request is one this spec answers.)
    expect(mock.unmocked.filter((r) => !r.endsWith('/all'))).toEqual([]);
  });

  test('says Available, Taken and the rule as the username is typed, and a failed check blocks nothing', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openDrawer(page);
    const field = page.locator('#add-learner-username');
    await expect(note(page)).toHaveAttribute('aria-live', 'polite');

    await field.fill('sokha1');
    await expect(note(page)).toHaveText('Available. Learners use this to sign in.');
    await field.fill('takenname');
    await expect(note(page)).toHaveText('That username is taken.');
    await field.fill('a');
    await expect(note(page)).toHaveText('Use 2 to 16 English letters or numbers.');
    await field.fill('has space');
    await expect(note(page)).toHaveText('Use 2 to 16 English letters or numbers.');
    // One request for each settled value, none for a value the rule already refuses.
    expect(mock.availabilityCalls).toEqual(['sokha1', 'takenname']);

    // A check that fails says nothing and a save still goes to the server.
    mock.availabilityStatus = 500;
    await field.fill('sokha2');
    await expect.poll(() => mock.availabilityCalls.length).toBe(3);
    await expect(note(page)).toHaveText('');
    await fillRequired(page, 'sokha2');
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(page.getByTestId('done-username')).toHaveText('sokha1');
    expect(mock.created).toHaveLength(1);
  });

  test('typing a username character by character asks once, for the value it settles on', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openDrawer(page);
    // A person types a few characters a second; every pause shorter than the debounce is not a question.
    await page.locator('#add-learner-username').pressSequentially('sokha123', { delay: 80 });
    await expect(note(page)).toHaveText('Available. Learners use this to sign in.');
    expect(mock.availabilityCalls, 'Debounced: one request').toEqual(['sokha123']);
  });

  test('an answer for an earlier username never lands on a later one that breaks the rule', async ({ context }) => {
    const mock = newMock();
    mock.delays['abc'] = 900;
    const page = await openLearners(context, mock);
    await openDrawer(page);
    const field = page.locator('#add-learner-username');
    await field.fill('abc');
    await expect.poll(() => mock.availabilityCalls).toEqual(['abc']); // asked; the answer is held back
    await page.evaluate(() => {
      const seen: string[] = ((window as any).__notes = []);
      const el = document.querySelector('[data-testid="username-note"]')!;
      new MutationObserver(() => seen.push(el.textContent ?? '')).observe(el, { childList: true, characterData: true, subtree: true });
    });
    await field.pressSequentially('!');
    await expect(note(page)).toHaveText('Use 2 to 16 English letters or numbers.');
    await page.waitForTimeout(1200); // the held answer would land now
    await expect(note(page)).toHaveText('Use 2 to 16 English letters or numbers.');
    const seen = await page.evaluate(() => (window as any).__notes as string[]);
    expect(seen.join('|'), 'Available. was never shown for abc!').not.toContain('Available');
  });

  test('an answer for an earlier username never shows against a later one, not even while it waits to be asked', async ({ context }) => {
    const mock = newMock();
    mock.taken.add('abcd');
    mock.delays['abc'] = 700;
    mock.delays['abcd'] = 500;
    const page = await openLearners(context, mock);
    await openDrawer(page);
    const field = page.locator('#add-learner-username');
    await field.fill('abc');
    await expect.poll(() => mock.availabilityCalls).toEqual(['abc']);
    await page.evaluate(() => {
      const seen: string[] = ((window as any).__notes = []);
      const el = document.querySelector('[data-testid="username-note"]')!;
      new MutationObserver(() => seen.push(el.textContent ?? '')).observe(el, { childList: true, characterData: true, subtree: true });
    });
    await field.fill('abcd');
    await expect(note(page)).toHaveText('That username is taken.', { timeout: 5000 });
    await page.waitForTimeout(1000);
    await expect(note(page)).toHaveText('That username is taken.');
    const seen = await page.evaluate(() => (window as any).__notes as string[]);
    expect(seen.join('|'), 'Available. was never shown for abcd').not.toContain('Available');
  });

  test('Generate fills a two-word password with two digits, turns Show on, and Show hides it again', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await openDrawer(page);
    const password = page.locator('#add-learner-password');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Generate' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    const value = await password.inputValue();
    expect(value).toMatch(/^[a-z]{8,12}[0-9]{2}$/);
    await page.getByRole('button', { name: 'Hide' }).click();
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Generate' }).click();
    await expect(password).not.toHaveValue(value);
  });

  test('sends exactly the contract body, leaving out the optional keys when empty and including them when filled', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(page.getByTestId('done-username')).toBeVisible();
    expect(mock.created).toHaveLength(1);
    expect(mock.created[0]).toEqual({
      schoolid: 'school-a',
      standard: 'class-a1',
      curriculumids: ['cur-1'],
      studentfirstname: FIRST,
      schoolusername: 'sokha1',
      password: 'riverlamp47',
      genderid: 2,
    });

    await page.getByRole('button', { name: 'Done' }).click();
    await openDrawer(page);
    await fillRequired(page, 'dara2', 'maplestone09');
    await page.locator('#add-learner-last').fill(`  ${LAST} `);
    await page.locator('#add-learner-dob').fill('2014-03-05');
    await page.getByRole('radio', { name: 'Male', exact: true }).check({ force: true });
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(page.getByTestId('done-username')).toBeVisible();
    expect(mock.created[1]).toEqual({
      schoolid: 'school-a',
      standard: 'class-a1',
      curriculumids: ['cur-1'],
      studentfirstname: FIRST,
      studentlastname: LAST,
      schoolusername: 'dara2',
      password: 'maplestone09',
      genderid: 1,
      dateofbirth: '2014-03-05',
    });
  });

  test('shows the username and the password once, with Copy, then forgets the password on close', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    const listCallsBefore = mock.listCalls;
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(page.getByTestId('done-username')).toHaveText('sokha1');
    await expect(page.getByTestId('done-password')).toHaveText('riverlamp47');
    await expect(page.getByTestId('done-notice')).toHaveText('Write it down or copy it now; it is not shown again.');
    await expect(page.locator('#add-learner-password'), 'the form is gone').toHaveCount(0);
    expect(mock.listCalls, 'the learners list was asked again').toBeGreaterThan(listCallsBefore);

    await seedClipboard(page, context, false);
    await page.getByRole('button', { name: 'Copy password' }).click();
    await expect(page.getByRole('button', { name: 'Copied password' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('riverlamp47');
    await seedClipboard(page, context, false);
    await page.getByRole('button', { name: 'Copy username' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('sokha1');

    await page.getByRole('button', { name: 'Done' }).click();
    await expect(drawer(page)).toBeHidden();
    expect(await page.locator('body').innerText(), 'the password is nowhere on the page').not.toContain('riverlamp47');
    expect(await page.locator('body').innerHTML(), 'nor in its markup').not.toContain('riverlamp47');

    await openDrawer(page);
    for (const id of ['first', 'last', 'username', 'password', 'dob']) {
      await expect(page.locator(`#add-learner-${id}`), id).toHaveValue('');
    }
    await expect(page.getByTestId('done-password')).toHaveCount(0);
    expect(await page.locator('body').innerHTML()).not.toContain('riverlamp47');
  });

  /** Opens the done panel for sokha1 / riverlamp47. `stubs` runs in the page before the app, to refuse a copy route. */
  async function openDonePanel(context: BrowserContext, stubs?: () => void): Promise<Page> {
    if (stubs) await context.addInitScript(stubs);
    // A refusal spec holds only clipboard-read, so the permission state matches the real failure ("denied").
    const page = await openLearners(context, newMock(), undefined, !stubs);
    await openDrawer(page);
    await fillRequired(page);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(page.getByTestId('done-username')).toHaveText('sokha1');
    return page;
  }
  const refuseClipboardApi = () => {
    (window as unknown as { __realWriteText: (t: string) => Promise<void> }).__realWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')),
    });
  };
  // (Each stub is serialised into the page on its own, so it cannot call the other.)
  const refuseBoth = () => {
    (window as unknown as { __realWriteText: (t: string) => Promise<void> }).__realWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')),
    });
    document.execCommand = () => false;
  };
  /** The system clipboard, read back through the browser (clipboard-read is granted in openLearners). */
  const clipboardText = (page: Page) => page.evaluate(() => navigator.clipboard.readText());
  /**
   * The headless browser has one clipboard for every test, so a read-back could pass on a value an earlier test left.
   * Writes a random sentinel first and returns it. A refusal spec has no write permission, so it is granted for this
   * write (through the page's own unstubbed writeText) and taken away again.
   */
  async function seedClipboard(page: Page, context: BrowserContext, refusing: boolean): Promise<string> {
    const sentinel = `sentinel-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    const origin = new URL(BASE_URL).origin;
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    await page.evaluate(
      (value) => {
        const real = (window as unknown as { __realWriteText?: (t: string) => Promise<void> }).__realWriteText;
        return (real ?? navigator.clipboard.writeText.bind(navigator.clipboard))(value);
      },
      sentinel,
    );
    if (refusing) {
      await context.clearPermissions();
      await context.grantPermissions(['clipboard-read'], { origin });
    }
    expect(await clipboardText(page), 'the sentinel is on the clipboard').toBe(sentinel);
    return sentinel;
  }

  test('Copy still works when the Clipboard API refuses the write: the password and the username reach the clipboard', async ({ context }) => {
    const page = await openDonePanel(context, refuseClipboardApi);
    await seedClipboard(page, context, true);
    await page.getByRole('button', { name: 'Copy password' }).click();
    await expect(page.getByRole('button', { name: 'Copied password' })).toBeVisible();
    await expect(page.getByText("The copy didn't work")).toHaveCount(0);
    expect(await clipboardText(page)).toBe('riverlamp47');
    await seedClipboard(page, context, true);
    await page.getByRole('button', { name: 'Copy username' }).click();
    await expect(page.getByRole('button', { name: 'Copied username' })).toBeVisible();
    await expect(page.getByText("The copy didn't work")).toHaveCount(0);
    expect(await clipboardText(page)).toBe('sokha1');
  });

  test('Copy says it did not work, and stays Copy, only when both copy routes fail', async ({ context }) => {
    const page = await openDonePanel(context, refuseBoth);
    const sentinel = await seedClipboard(page, context, true);
    await page.getByRole('button', { name: 'Copy password' }).click();
    await expect(page.getByText("The copy didn't work. Select the password and copy it by hand.")).toBeVisible();
    expect(await clipboardText(page), 'nothing was copied').toBe(sentinel);
    await expect(page.getByRole('button', { name: 'Copy password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copied password' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Copy username' }).click();
    await expect(page.getByText("The copy didn't work. Select the username and copy it by hand.")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy username' })).toBeVisible();
    expect(await clipboardText(page), 'nothing was copied').toBe(sentinel);
    await expect(page.locator('textarea')).toHaveCount(0);
  });

  test('Copy through the working Clipboard API still reaches the clipboard, and leaves nothing behind in the drawer', async ({ context }) => {
    const page = await openDonePanel(context);
    await seedClipboard(page, context, false);
    await page.getByRole('button', { name: 'Copy password' }).click();
    await expect(page.getByRole('button', { name: 'Copied password' })).toBeVisible();
    expect(await clipboardText(page)).toBe('riverlamp47');
    await expect(page.locator('textarea')).toHaveCount(0);
  });

  for (const [title, stubs] of [
    ['refused by the Clipboard API', refuseClipboardApi],
    ['refused by both routes', refuseBoth],
    ['by the Clipboard API', undefined],
  ] as const) {
    test(`after a copy ${title}, no textarea is left in the drawer and focus is on the pressed button`, async ({ context }) => {
      const page = await openDonePanel(context, stubs);
      for (const which of ['password', 'username']) {
        const button = page.getByRole('button', { name: new RegExp(`^Cop(y|ied) ${which}$`) });
        await seedClipboard(page, context, !!stubs);
        await button.click();
        await expect(button).toHaveText(/Cop(y|ied)/);
        await expect(page.locator('textarea')).toHaveCount(0);
        await expect(button).toBeFocused();
      }
    });
  }

  for (const [status, text, tone] of [
    ['pushed', `${FULL} can sign in now with these details.`, 'ok'],
    ['failed', `${FULL} can't sign in yet. ${SYNC_MESSAGE}`, 'warn'],
    ['skipped', `${FULL} can sign in once the learning server next syncs.`, 'info'],
  ] as const) {
    test(`the done panel for a push that ${status} says so, in the panel and not in a toast`, async ({ context }) => {
      const mock = newMock();
      mock.createAnswer = () =>
        json(201, {
          schooluserid: 'su-1',
          schoolusername: 'sokha1',
          studentname: FULL,
          push: { status, message: SYNC_MESSAGE },
        });
      const page = await openLearners(context, mock);
      await openDrawer(page);
      await fillRequired(page);
      await page.getByRole('button', { name: 'Add learner', exact: true }).click();
      await expect(page.getByTestId('done-outcome')).toHaveText(text);
      await expect(page.getByTestId('done-outcome')).toHaveClass(tone === 'warn' ? /warn/ : /^((?!warn).)*$/);
      // The details are all still there, and nothing covers them.
      await expect(page.getByTestId('done-username')).toHaveText('sokha1');
      await expect(page.getByTestId('done-password')).toHaveText('riverlamp47');
      await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
      await page.waitForTimeout(300);
      expect(await toasts(page).count(), 'no toast: the outcome is in the panel').toBe(0);
      expect(await page.locator('.ant-notification-notice').count()).toBe(0);
    });
  }

  test('after a save the heading takes focus and is described by the outcome line', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    const title = page.getByRole('heading', { name: 'Learner added', exact: true });
    await expect(title).toBeFocused();
    await expect(title).toHaveAttribute('tabindex', '-1');
    await expect(title).toHaveAccessibleDescription(`${FULL} can sign in now with these details.`);
  });

  test('a 400 is shown under the field it names, in the API’s own words, and nothing else is cleared', async ({ context }) => {
    const mock = newMock();
    const PASSWORD_SAYS = 'Use 8 to 32 characters with at least one letter and one number, and no spaces.';
    mock.createAnswer = () =>
      invalid([
        { field: 'schoolusername', message: 'That username is taken.' },
        { field: 'password', message: PASSWORD_SAYS },
        { field: 'standard', message: 'Choose a class of this school.' },
      ]);
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(note(page)).toHaveText('That username is taken.');
    await expect(errorOf(page, '#add-learner-password')).toHaveText(PASSWORD_SAYS);
    await expect(errorOf(page, '#add-learner-class')).toHaveText('Choose a class of this school.');
    await expect(errorOf(page, '#add-learner-first')).toHaveCount(0);
    await expect(errorOf(page, '#add-learner-school')).toHaveCount(0);
    await expect(errorOf(page, '#add-learner-curricula')).toHaveCount(0);
    // Nothing was cleared.
    await expect(page.locator('#add-learner-first')).toHaveValue(FIRST);
    await expect(page.locator('#add-learner-username')).toHaveValue('sokha1');
    await expect(page.locator('#add-learner-password')).toHaveValue('riverlamp47');
    await expect(page.getByRole('radio', { name: 'Female', exact: true })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Add learner', exact: true }), 'Save is enabled again').toBeEnabled();
    expect(await toasts(page).count(), 'a validation failure is not a toast').toBe(0);
    // Editing a field takes its own message away and leaves the others.
    await page.locator('#add-learner-password').fill('riverlamp48');
    await expect(errorOf(page, '#add-learner-password')).toHaveCount(0);
    await expect(errorOf(page, '#add-learner-class')).toHaveText('Choose a class of this school.');
  });

  test('a 400 that names no field (no organisation chosen) is said once at the top of the form', async ({ context }) => {
    const mock = newMock();
    mock.createAnswer = () => json(400, { error: true, code: 'INVALID_INPUT', errormessage: 'Choose an organisation.' });
    // (The body names no field here; the next test is the one central sends, naming School.)
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(drawer(page).locator('.form-error')).toHaveText('Choose an organisation.');
    expect(await toasts(page).count()).toBe(0);
  });

  test('the “Choose an organisation.” 400 that names School is shown under School', async ({ context }) => {
    const mock = newMock();
    mock.createAnswer = () => invalid([{ field: 'schoolid', message: 'Choose an organisation.' }]);
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(errorOf(page, '#add-learner-school')).toHaveText('Choose an organisation.');
    await expect(drawer(page).locator('.form-error')).toHaveCount(0);
  });

  test('names are limited to 45 characters, the first at least 2, and extra push keys are ignored', async ({ context }) => {
    const mock = newMock();
    mock.createAnswer = () =>
      json(201, {
        schooluserid: 'su-1', schoolusername: 'sokha1', studentname: FULL,
        push: { status: 'failed', message: 'x', cause: 'timeout', hint: 'retry', code: 'E1', reason: 'nocloud' },
      });
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await expect(page.locator('#add-learner-first')).toHaveAttribute('maxlength', '45');
    await expect(page.locator('#add-learner-last')).toHaveAttribute('maxlength', '45');
    await fillRequired(page);
    await page.locator('#add-learner-first').fill('ស');
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(errorOf(page, '#add-learner-first')).toHaveText('Enter a name of 2 to 45 characters.');
    expect(mock.created).toEqual([]);
    await page.locator('#add-learner-first').fill('');
    await page.locator('#add-learner-first').pressSequentially('ស'.repeat(60));
    expect(await page.locator('#add-learner-first').inputValue()).toHaveLength(45);
    await page.locator('#add-learner-first').fill(FIRST);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(page.getByTestId('done-outcome')).toHaveText(`${FULL} can't sign in yet. x`);
  });

  test("a push that failed because the learning server lacks the class or curriculum shows central's own sentence", async ({ context }) => {
    const mock = newMock();
    mock.createAnswer = () => json(201, { schooluserid: 'su-1', schoolusername: 'sokha1', studentname: FULL, push: { status: 'failed', message: MISSING_MESSAGE } });
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(page.getByTestId('done-outcome')).toHaveText(`${FULL} can't sign in yet. ${MISSING_MESSAGE}`);
  });

  test('required fields are named before anything is sent, and the first empty one takes focus', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(errorOf(page, '#add-learner-first')).toHaveText('Enter a name of 2 to 45 characters.');
    await expect(page.locator('#add-learner-username')).toHaveAttribute('aria-invalid', 'true');
    await expect(note(page)).toHaveText('Enter a username.');
    await expect(errorOf(page, '#add-learner-password')).toHaveText('Enter a password.');
    await expect(errorOf(page, '#add-learner-school')).toHaveText('Choose a school.');
    await expect(errorOf(page, '#add-learner-class')).toHaveText('Choose a class.');
    await expect(errorOf(page, '#add-learner-curricula')).toHaveText('Choose at least one curriculum.');
    await expect(drawer(page).getByRole('group', { name: 'Gender' }).locator('.field-error')).toHaveText('Choose a gender.');
    await expect(drawer(page).getByRole('radiogroup')).toHaveCount(0);
    await expect(page.locator('#add-learner-first')).toBeFocused();
    expect(mock.created, 'nothing was sent').toEqual([]);
    await page.locator('#add-learner-first').fill(FIRST);
    await page.locator('#add-learner-username').fill('sokha1');
    await page.locator('#add-learner-password').fill('short1');
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(errorOf(page, '#add-learner-password')).toHaveText('Use 8 to 32 characters with at least one letter and one number, and no spaces.');
    expect(mock.created).toEqual([]);
  });

  test('a school’s classes and curricula follow the school; changing the school empties them; one school or curriculum is preselected', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await expect(page.locator('#add-learner-class')).toHaveClass(/ant-select-disabled/);
    await choose(page, 'add-learner-school-input', 'North Valley School');
    await choose(page, 'add-learner-class-input', 'Class 2A');
    await choose(page, 'add-learner-curricula-input', 'Number Skills');
    await page.keyboard.press('Escape');
    await expect(page.locator('#add-learner-class .ant-select-selection-item')).toHaveText('Class 2A');
    await choose(page, 'add-learner-school-input', 'South Hill School');
    await expect(page.locator('#add-learner-class .ant-select-selection-item'), 'the class was reset').toHaveCount(0);
    // South Hill has one curriculum, so it is chosen for the person.
    await expect(page.locator('#add-learner-curricula .ant-select-selection-item-content')).toHaveText('Science Starters');
    await page.locator('#add-learner-class .ant-select-selector').click();
    await expect(page.locator('.ant-select-item-option')).toHaveText(['Class 9B']);

    // One school only: it is the school, with its single curriculum.
    const single = newMock();
    single.schools = [SCHOOL_B];
    const context2 = await page.context().browser()!.newContext({ baseURL: BASE_URL });
    try {
      const page2 = await openLearners(context2, single);
      await openDrawer(page2);
      await expect(page2.locator('#add-learner-school .ant-select-selection-item')).toHaveText('South Hill School');
      await expect(page2.locator('#add-learner-curricula .ant-select-selection-item-content')).toHaveText('Science Starters');
    } finally {
      await context2.close();
    }
  });

  test('a school with no classes or no curricula says so under the field, before anything is saved', async ({ context }) => {
    const mock = newMock();
    mock.schools = [SCHOOL_A, SCHOOL_C];
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await expect(page.getByTestId('no-classes')).toHaveCount(0);
    await expect(page.getByTestId('no-curricula')).toHaveCount(0);
    await choose(page, 'add-learner-school-input', 'Empty Hill School');
    await expect(page.getByTestId('no-classes')).toHaveText('This school has no classes yet. Add one on the Schools screen.');
    await expect(page.getByTestId('no-curricula')).toHaveText('This school has no curricula yet.');
    await choose(page, 'add-learner-school-input', 'North Valley School');
    await expect(page.getByTestId('no-classes')).toHaveCount(0);
    await expect(page.getByTestId('no-curricula')).toHaveCount(0);
  });

  test('closing counts every field as a change, but not what the form chose for the person', async ({ context }) => {
    const confirm = (page: Page) => page.getByRole('alertdialog', { name: 'Discard this learner?' });
    const changes: Array<[string, (page: Page) => Promise<void>]> = [
      ['School', (page) => choose(page, 'add-learner-school-input', 'North Valley School')],
      ['Class', async (page) => {
        await choose(page, 'add-learner-school-input', 'South Hill School');
        // South Hill's one curriculum was chosen for the person; the class is theirs.
        await choose(page, 'add-learner-class-input', 'Class 9B');
      }],
      ['Curriculum', async (page) => {
        await choose(page, 'add-learner-school-input', 'North Valley School');
        await choose(page, 'add-learner-curricula-input', 'Reading Basics');
        await page.keyboard.press('Escape');
      }],
      ['Gender', (page) => page.locator('label.segment').filter({ hasText: /^Male$/ }).click()],
      ['Date of birth', (page) => page.locator('#add-learner-dob').fill('2014-03-05')],
      ['First name', (page) => page.locator('#add-learner-first').fill(FIRST)],
    ];
    for (const [what, change] of changes) {
      const page = await openLearners(context, newMock());
      await openDrawer(page);
      await change(page);
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(confirm(page), `${what} is a change`).toBeVisible();
      await page.getByRole('button', { name: 'Discard' }).click();
      await expect(drawer(page)).toBeHidden();
      await page.close();
    }
    // Untouched: closes at once. With one school, that school and its one curriculum were chosen for the person.
    const only = newMock();
    only.schools = [SCHOOL_B];
    const page = await openLearners(context, only);
    await openDrawer(page);
    await expect(page.locator('#add-learner-school .ant-select-selection-item')).toHaveText('South Hill School');
    await expect(page.locator('#add-learner-curricula .ant-select-selection-item-content')).toHaveText('Science Starters');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(drawer(page)).toBeHidden();
    await expect(confirm(page)).toHaveCount(0);
  });

  test('a date of birth that is partly typed or out of range is named, not dropped', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    const dob = page.locator('#add-learner-dob');
    const today = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const message = 'Enter a date of birth between 1900 and yesterday.';
    await expect(dob).toHaveAttribute('min', '1900-01-01');
    const max = (await dob.getAttribute('max'))!;
    expect(max < today && max >= new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10), 'max is yesterday').toBe(true);
    const submit = () => page.getByRole('button', { name: 'Add learner', exact: true }).click();

    // Month and day without a year.
    await dob.click();
    await page.keyboard.type('0305');
    await submit();
    await expect(errorOf(page, '#add-learner-dob')).toHaveText(message);
    expect(mock.created, 'nothing was sent').toEqual([]);

    for (const bad of ['1899-12-31', today, '2999-01-01']) {
      await dob.fill(bad);
      await submit();
      await expect(errorOf(page, '#add-learner-dob'), bad).toHaveText(message);
      expect(mock.created, `${bad} was not sent`).toEqual([]);
    }
    // Editing it takes the message away; a good date goes through.
    await dob.fill('1900-01-01');
    await expect(errorOf(page, '#add-learner-dob')).toHaveCount(0);
    await submit();
    await expect(page.getByTestId('done-username')).toBeVisible();
    expect(mock.created[0]).toMatchObject({ dateofbirth: '1900-01-01' });
  });

  test('a 404 that names the school is shown under School', async ({ context }) => {
    const mock = newMock();
    mock.createAnswer = () =>
      json(404, { error: true, code: 'NOT_FOUND', errormessage: "That school doesn't exist.", fields: [{ field: 'schoolid', message: "That school doesn't exist." }] });
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(errorOf(page, '#add-learner-school')).toHaveText("That school doesn't exist.");
    await expect(drawer(page).locator('.form-error')).toHaveCount(0);
  });

  test('the username check’s own 400, naming `username`, shows the rule under Username', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await context.route(`${API_URL}/student/username-available*`, (route) =>
      route.fulfill(json(400, { error: true, code: 'INVALID_INPUT', errormessage: 'x', fields: [{ field: 'username', message: 'Use 2 to 16 English letters or numbers.' }] })),
    );
    await openDrawer(page);
    await page.locator('#add-learner-username').fill('okname');
    await expect(note(page)).toHaveText('Use 2 to 16 English letters or numbers.');
  });

  test('screenshots for the review (only when E2E_SHOTS names a folder)', async ({ context }) => {
    test.skip(!process.env.E2E_SHOTS, 'set E2E_SHOTS to a folder to write them');
    const dir = process.env.E2E_SHOTS!;
    const page = await openLearners(context, newMock());
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDrawer(page);
    await fillRequired(page);
    await page.locator('#add-learner-last').fill(LAST);
    await page.getByRole('button', { name: 'Show' }).click();
    await expect(note(page)).toHaveText('Available. Learners use this to sign in.');
    await drawer(page).locator('.head').click(); // closes the open list
    await expect(page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')).toHaveCount(0);
    await drawer(page).locator('.body').evaluate((el) => (el.scrollTop = 0));
    await page.screenshot({ path: `${dir}/add-learner-form.png` });
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(page.getByTestId('done-outcome')).toBeVisible();
    await page.screenshot({ path: `${dir}/add-learner-done.png` });
  });

  test('screenshot of a push that failed (only when E2E_SHOTS names a folder)', async ({ context }) => {
    test.skip(!process.env.E2E_SHOTS, 'set E2E_SHOTS to a folder to write them');
    const mock = newMock();
    mock.createAnswer = () =>
      json(201, { schooluserid: 'su-1', schoolusername: 'sokha1', studentname: FULL, push: { status: 'failed', message: 'x' } });
    const page = await openLearners(context, mock);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDrawer(page);
    await fillRequired(page);
    await page.locator('#add-learner-last').fill(LAST);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(page.getByTestId('done-outcome')).toBeVisible();
    await page.screenshot({ path: `${process.env.E2E_SHOTS}/add-learner-done-failed.png` });
  });

  test('the browser Back button closes the drawer completely: the password is gone and the next opening is empty', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await page.evaluate(() => history.pushState({}, '', location.href));
    await openDrawer(page);
    await fillRequired(page);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(page.getByTestId('done-password')).toHaveText('riverlamp47');
    await page.goBack();
    await expect(drawer(page)).toHaveCount(0);
    await page.getByTestId('add-learner').click();
    await expect(drawer(page)).toBeVisible();
    await expect(page.locator('#add-learner-first')).toHaveValue('');
    await expect(page.locator('#add-learner-password')).toHaveValue('');
    await expect(page.getByTestId('done-password')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toContain('riverlamp47');
    expect(await page.content()).not.toContain('riverlamp47');
  });

  test('a space after the username is ignored by the live note and by Save, and the trimmed name is sent', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await fillRequired(page, 'sokha1 ');
    await expect(note(page)).toHaveText('Available. Learners use this to sign in.');
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(page.getByTestId('done-username')).toHaveText('sokha1');
    expect(mock.created).toHaveLength(1);
    expect(mock.created[0].schoolusername).toBe('sokha1');
  });

  test('a deleted curriculum (listed without a name) is not offered, and a school left with none says so', async ({ context }) => {
    const mock = newMock();
    mock.schools = [SCHOOL_A, SCHOOL_D];
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await choose(page, 'add-learner-school-input', 'Gone Curriculum School');
    await expect(page.getByTestId('no-curricula')).toHaveText('This school has no curricula yet.');
    await expect(page.locator('#add-learner-curricula .ant-select-selection-item')).toHaveCount(0);
    await page.locator('#add-learner-curricula .ant-select-selector').click();
    await expect(page.locator('.ant-select-item-option')).toHaveCount(0);
  });

  test('the notes under Class and Curriculum are linked to their selects', async ({ context }) => {
    const mock = newMock();
    mock.schools = [SCHOOL_A, SCHOOL_C];
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await choose(page, 'add-learner-school-input', 'Empty Hill School');
    await expect(page.getByTestId('no-classes')).toBeVisible();
    await expect(page.locator('#add-learner-class')).toHaveAttribute('aria-describedby', 'add-learner-class-note');
    await expect(page.locator('#add-learner-class-note')).toHaveText(/no classes yet/);
    await expect(page.locator('#add-learner-curricula')).toHaveAttribute('aria-describedby', 'add-learner-curricula-note');
    await expect(page.locator('#add-learner-curricula-note')).toHaveText(/no curricula yet/);
  });

  test('in the platform view (no acting organisation) the button is disabled and no drawer opens', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock, { isplatform: true, organisationid: null, lmsuserrole: 'Mapyr2Pw' });
    const button = page.getByTestId('add-learner');
    await expect(button).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Upload Users' })).toBeDisabled();
    await button.click({ force: true }).catch(() => undefined);
    await expect(page.getByRole('dialog', { name: /Add learner/ })).toHaveCount(0);
    const box = (await button.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('.ant-tooltip:not(.ant-tooltip-hidden)')).toContainText('Choose an organisation to act in');
  });
});

test.describe('only published curricula are offered', () => {
  const offered = (page: Page) => page.locator('.ant-select-item-option').allTextContents().then((t) => t.map((x) => x.trim()));

  async function openCurricula(page: Page): Promise<void> {
    await openDrawer(page);
    await choose(page, 'add-learner-school-input', 'North Valley School');
    await expect(page.locator('#add-learner-curricula')).toBeVisible();
    await page.locator('#add-learner-curricula .ant-select-selector').click();
  }

  test('a curriculum never published is not offered', async ({ context }) => {
    const mock = newMock();
    mock.publication = { 'cur-2': 'never' };
    const page = await openLearners(context, mock);
    await openCurricula(page);
    await expect.poll(() => offered(page)).toEqual(['Reading Basics']);
    expect([...mock.publicationReads].sort()).toEqual(['cur-1', 'cur-2']);
  });

  test('a curriculum retired is not offered', async ({ context }) => {
    const mock = newMock();
    mock.publication = { 'cur-1': 'withdrawn' };
    const page = await openLearners(context, mock);
    await openCurricula(page);
    await expect.poll(() => offered(page)).toEqual(['Number Skills']);
  });

  test('published curricula are all offered', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openCurricula(page);
    await expect.poll(() => offered(page)).toEqual(['Reading Basics', 'Number Skills']);
  });

  test('a publication read that fails leaves the curricula offered, and says nothing', async ({ context }) => {
    const mock = newMock();
    mock.publicationFails = true;
    const page = await openLearners(context, mock);
    await openCurricula(page);
    await expect.poll(() => offered(page)).toEqual(['Reading Basics', 'Number Skills']);
    await page.waitForTimeout(500);
    expect(await toasts(page).count(), 'a failed read is not a toast').toBe(0);
  });

  test("central's 400 on curriculumids is shown under the Curriculum field, in its own words", async ({ context }) => {
    const mock = newMock();
    const SAYS = 'Publish Reading Basics first, or choose another curriculum.';
    mock.createAnswer = () => invalid([{ field: 'curriculumids', message: SAYS }]);
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(errorOf(page, '#add-learner-curricula')).toHaveText(SAYS);
    expect(await toasts(page).count(), 'a validation failure is not a toast').toBe(0);
    await expect(drawer(page)).toBeVisible();
  });
});
