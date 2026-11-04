import { APIRequestContext, Page, Request, expect, test } from '@playwright/test';
import { apiContext, loginViaUi } from '../fixtures/auth';

/**
 * The Edit organisation drawer's switch "Learners must pass the quiz to finish a lesson". Real API.
 *
 * The list row does not carry the setting, so the drawer reads the organisation by id when it opens. What is pinned here:
 * the switch's label and help text, that it shows what the API holds, that a save sends the value only when it was changed,
 * that the API holds what was sent (read back by id, not only a 200), that a failed read leaves the switch unusable and the
 * save silent about it, and that the New drawer has no such switch.
 *
 * Every organisation made here has a code starting "e2e" + a random suffix (RUN) and is deleted through the API in teardown
 * (soft deletes: see organisation.spec.ts for how to count the rows a run leaves).
 */

const RUN = `e2eq${Math.random().toString(36).slice(2, 7)}`;
let counter = 0;
const created: string[] = [];
let api: APIRequestContext;
let page: Page;

const LABEL = 'Learners must pass the quiz to finish a lesson';
const HELP = "When on, a failed quiz can be retried as many times as needed. The lesson isn't complete until it is passed.";

async function tokenOf(p: Page): Promise<string> {
  return p.evaluate(() => {
    const g = (k: string) => sessionStorage.getItem(k);
    return `${g('lms_access_alg')}.${g('lms_access_payload')}.${g('lms_access_hash')}`;
  });
}

async function makeViaApi(): Promise<{ id: string; name: string }> {
  counter += 1;
  const name = `ក្រុមហ៊ុនសាកល្បង ${RUN}-${counter}`;
  const countries = (await (await api.get('/country/all?country=')).json()).data;
  const res = await api.post('/organisation', {
    data: {
      organisationname: name,
      organisationcode: `${RUN}${counter}`,
      organisationshortname: 'កស',
      organisationpreset: 'company',
      countryids: [countries[0].countryid],
    },
  });
  expect(res.ok(), `could not create the organisation: ${res.status()}`).toBeTruthy();
  const id = (await res.json()).data.organisationid;
  created.push(id);
  return { id, name };
}

/** What the API holds for the setting, read by id. */
async function stored(id: string): Promise<boolean | undefined> {
  return (await (await api.get(`/organisation/${id}`)).json()).data.requireLessonQuizPass;
}

/** Sets it through the API, the way a second administrator would. */
async function setViaApi(id: string, value: boolean): Promise<void> {
  const full = (await (await api.get(`/organisation/${id}`)).json()).data;
  const res = await api.put(`/organisation/${id}`, {
    data: {
      organisationname: full.organisationname,
      organisationshortname: full.organisationshortname,
      countryids: full.countries.map((c: { countryid: string }) => c.countryid),
      requireLessonQuizPass: value,
    },
  });
  expect(res.ok(), `could not set it: ${res.status()}`).toBeTruthy();
}

const drawer = () => page.getByRole('dialog', { name: /organisation/i });
const quizSwitch = () => drawer().getByRole('switch', { name: LABEL });

async function openEdit(name: string): Promise<void> {
  await page.goto('/organisation');
  await expect(page.getByRole('heading', { level: 1, name: 'Organisations' })).toBeVisible();
  await page.getByRole('row').filter({ hasText: name }).getByRole('button', { name: `Edit ${name}` }).click();
  await expect(drawer().getByRole('heading', { name: 'Edit organisation' })).toBeVisible();
}

/** The switch has been read and can be used. */
async function ready(): Promise<void> {
  await expect(quizSwitch()).toBeEnabled();
  await expect(drawer().locator('nz-switch .ant-switch-loading')).toHaveCount(0);
}

/** Saves, and returns the body the browser sent in the PUT. */
async function save(): Promise<Record<string, unknown>> {
  const sent = page.waitForRequest((r: Request) => r.method() === 'PUT' && /\/organisation\/[^/]+$/.test(r.url()));
  const done = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/organisation\/[^/]+$/.test(r.url()));
  await drawer().getByRole('button', { name: 'Save changes' }).click();
  const body = (await sent).postDataJSON();
  expect((await done).status()).toBe(200);
  await expect(drawer()).toBeHidden();
  return body;
}

test.describe('the lesson quiz switch in the Edit organisation drawer', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUi(page);
    api = await apiContext(await tokenOf(page));
  });

  test.afterAll(async () => {
    for (const id of created) {
      const res = await api.delete(`/organisation/${id}`);
      if (!res.ok() && res.status() !== 404) throw new Error(`failed to delete organisation ${id}: HTTP ${res.status()}`);
    }
    await api.dispose();
    await page.close();
  });

  test('is there with its label and help text, off for a new organisation', async () => {
    const o = await makeViaApi();
    await openEdit(o.name);
    await ready();
    await expect(quizSwitch()).not.toBeChecked();
    await expect(drawer().getByText(LABEL, { exact: true })).toBeVisible();
    await expect(drawer().getByText(HELP, { exact: true })).toBeVisible();
    expect(await stored(o.id)).toBe(false);
  });

  test('turning it on sends true, the API holds true, and the drawer shows it on again', async () => {
    const o = await makeViaApi();
    await openEdit(o.name);
    await ready();
    await quizSwitch().click();
    await expect(quizSwitch()).toBeChecked();
    const body = await save();
    expect(body.requireLessonQuizPass).toBe(true);
    expect(await stored(o.id)).toBe(true);
    await openEdit(o.name);
    await ready();
    await expect(quizSwitch()).toBeChecked();
  });

  test('turning it off sends false (not a missing key), and the API holds false', async () => {
    const o = await makeViaApi();
    await setViaApi(o.id, true);
    await openEdit(o.name);
    await ready();
    await expect(quizSwitch()).toBeChecked();
    await quizSwitch().click();
    await expect(quizSwitch()).not.toBeChecked();
    const body = await save();
    expect(body).toHaveProperty('requireLessonQuizPass', false);
    expect(await stored(o.id)).toBe(false);
  });

  test('a save that leaves the switch alone sends nothing about it, so the API keeps its value', async () => {
    const o = await makeViaApi();
    await setViaApi(o.id, true);
    await openEdit(o.name);
    await ready();
    await drawer().getByLabel(/^Name/).fill(`${o.name} b`);
    const body = await save();
    expect(body).not.toHaveProperty('requireLessonQuizPass');
    expect(await stored(o.id)).toBe(true);
    o.name = `${o.name} b`;
  });

  test('changing the switch alone makes the form dirty: closing asks before discarding', async () => {
    const o = await makeViaApi();
    await openEdit(o.name);
    await ready();
    await drawer().getByRole('button', { name: 'Close' }).click();
    await expect(drawer()).toBeHidden();
    await openEdit(o.name);
    await ready();
    await quizSwitch().click();
    await drawer().getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText('Discard your changes?')).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(drawer()).toBeVisible();
  });

  test('when the read fails the switch cannot be used, the page says so, and a save does not touch the setting', async () => {
    const o = await makeViaApi();
    await setViaApi(o.id, true);
    let failing = true;
    await page.route(new RegExp(`/organisation/${o.id}$`), (route) => {
      if (failing && route.request().method() === 'GET') {
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: true, errormessage: 'nope' }) });
      }
      return route.continue();
    });
    await openEdit(o.name);
    await expect(drawer().getByTestId('org-quizpass-error')).toContainText("couldn't be loaded");
    await expect(quizSwitch()).toBeDisabled();
    await expect(quizSwitch()).not.toBeChecked();
    // everything else can still be saved
    await drawer().getByLabel(/^Name/).fill(`${o.name} c`);
    const body = await save();
    expect(body).not.toHaveProperty('requireLessonQuizPass');
    failing = false;
    expect(await stored(o.id), 'the value the API held is untouched').toBe(true);
    await page.unroute(new RegExp(`/organisation/${o.id}$`));
  });

  test('"Try again" reads it again and the switch then shows what the API holds', async () => {
    const o = await makeViaApi();
    await setViaApi(o.id, true);
    let failing = true;
    await page.route(new RegExp(`/organisation/${o.id}$`), (route) =>
      failing && route.request().method() === 'GET'
        ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: true }) })
        : route.continue(),
    );
    await openEdit(o.name);
    await expect(drawer().getByTestId('org-quizpass-error')).toBeVisible();
    failing = false;
    await drawer().getByRole('button', { name: 'Try again' }).click();
    await ready();
    await expect(quizSwitch()).toBeChecked();
    await expect(drawer().getByTestId('org-quizpass-error')).toHaveCount(0);
    await page.unroute(new RegExp(`/organisation/${o.id}$`));
  });

  test('the New organisation drawer has no such switch: the create call does not take it', async () => {
    await page.goto('/organisation');
    await page.getByRole('button', { name: '+ New organisation' }).first().click();
    await expect(drawer().getByRole('heading', { name: 'New organisation' })).toBeVisible();
    await expect(drawer().getByRole('switch')).toHaveCount(0);
    await expect(drawer().getByText(LABEL)).toHaveCount(0);
  });
});
