import { Page, expect } from '@playwright/test';
import { apiContext, apiLogin } from './auth';

/**
 * A CRUD round-trip through the real UI.
 *
 * Deliberately not the API. The point of this suite is the Angular 12 → current
 * ladder, and an API-level round-trip would pass happily while every form in
 * the app was broken. This drives the actual reactive form, the actual
 * ng-zorro table, and the actual routing — which is where an upgrade rung
 * breaks things.
 *
 * Every entity module follows the same shape: an index at /<route>/index with
 * an nz-table, a create form at /<route>/create, and an edit at
 * /<route>/update/:id reached from the row.
 */
export interface CrudEntity {
  /** Display name, used in the test title. */
  title: string;
  /** Route segment, e.g. 'subject'. */
  route: string;
  /** The formControlName whose value the table column renders. */
  labelField: string;
  /** The API's id field for this entity, e.g. 'subjectid' — used for cleanup. */
  idField: string;
  /**
   * Payloads built from a per-run seed. Each entity supplies its own because
   * the server's limits differ sharply and are not guessable: subjectname is
   * max 25 characters, while documenttagname is alphanum-only and max 8 — no
   * spaces, no timestamps. A shared label generator silently produced values
   * the API rejected with a 400, and the form simply did not navigate.
   */
  create: (seed: string) => Record<string, string>;
  update: (seed: string) => Record<string, string>;
}

/**
 * Four alphanumeric characters — short enough for the max-8 alphanum fields,
 * and unique per run so a failed run's leftovers cannot collide with the next.
 */
export const seedFor = (): string => Math.random().toString(36).slice(2, 6);

async function fillForm(page: Page, fields: Record<string, string>): Promise<void> {
  for (const [name, value] of Object.entries(fields)) {
    const field = page.locator(`[formControlName="${name}"]`);
    await expect(field, `no field ${name} on ${page.url()}`).toBeVisible();
    await field.fill(value);
  }
}

/**
 * The table row containing this text.
 *
 * `hasText` matches on **substring**, so an entity's updated label must not
 * contain its created label — otherwise "the old name is gone" silently
 * matches the renamed row and can never fail.
 */
export function rowFor(page: Page, label: string) {
  return page.locator('tbody tr').filter({ hasText: label });
}

export async function createEntity(
  page: Page,
  entity: CrudEntity,
  fields: Record<string, string>,
): Promise<void> {
  await page.goto(`/${entity.route}/create`);
  await fillForm(page, fields);
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.waitForURL(new RegExp(`/${entity.route}/index`), { timeout: 15_000 });
}

export async function updateEntity(
  page: Page,
  entity: CrudEntity,
  currentLabel: string,
  newFields: Record<string, string>,
): Promise<void> {
  await rowFor(page, currentLabel).getByRole('link', { name: 'Edit' }).click();
  await page.waitForURL(new RegExp(`/${entity.route}/update/`), { timeout: 15_000 });
  // The edit form patches itself from a GET after the route resolves. Wait for
  // the current value to land before overwriting it, or the fill races the
  // response and the old value wins.
  await expect(page.locator(`[formControlName="${entity.labelField}"]`)).toHaveValue(
    currentLabel,
    { timeout: 15_000 },
  );
  await fillForm(page, newFields);
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.waitForURL(new RegExp(`/${entity.route}/index`), { timeout: 15_000 });
}

/**
 * Remove any rows this suite left behind, via the API.
 *
 * A passing round-trip deletes its own row as its last step. A *failing* one
 * stops at the assertion, so without this every red run leaves an `e2e…` row
 * sitting in the list — which is how a dev database quietly fills with test
 * junk while everyone ignores it.
 *
 * "Delete" here means what it means everywhere in this app: a soft delete that
 * sets deleted_at and drops the row out of the listing. Tombstones accumulate,
 * exactly as they do when a real user deletes a subject. That is the app's
 * model, not residue from the suite.
 *
 * Best-effort: cleanup must never fail a run or mask the real failure.
 */
export async function cleanupLeftovers(entities: CrudEntity[]): Promise<void> {
  let ctx;
  try {
    ctx = await apiContext(await apiLogin());
  } catch {
    return;
  }
  for (const entity of entities) {
    try {
      const res = await ctx.post(`/${entity.route}`, {
        data: { pageindex: 0, pagesize: 200 },
      });
      if (!res.ok()) continue;
      const body = await res.json();
      const rows: Array<Record<string, string>> = body?.data?.data ?? [];
      const mine = rows.filter((row) => String(row[entity.labelField] ?? '').startsWith('e2e'));
      for (const row of mine) {
        await ctx.delete(`/${entity.route}/${row[entity.idField]}`).catch(() => undefined);
      }
    } catch {
      // Ignore: this is housekeeping, not an assertion.
    }
  }
  await ctx.dispose();
}

export async function deleteEntity(page: Page, label: string): Promise<void> {
  // Not getByRole('link'): the delete control is an <a nz-button nz-popconfirm>
  // with no href, and an anchor without href has no implicit link role — the
  // locator matches nothing and simply hangs until the test times out. Edit
  // gets away with getByRole('link') because routerLink emits an href.
  await rowFor(page, label).getByText('Delete', { exact: true }).click();
  // ng-zorro popconfirm: "Sure to delete?", confirmed with an OK button that
  // renders in an overlay outside the row.
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(rowFor(page, label)).toHaveCount(0, { timeout: 15_000 });
}
