import { test, expect } from '@playwright/test';
import { apiContext, apiLogin, loginViaUi } from '../fixtures/auth';

/**
 * The sync-record report's filename search lived in an <nz-dropdown-menu>
 * that nothing referenced — no <nz-filter-trigger> in any <th> — so the
 * search box was unreachable through the UI (and for a while it also sent
 * the wrong filter key, 'standardname'). These checks are deliberately
 * data-independent: they assert the affordance exists and that Search sends
 * a `filename` filter, not what rows come back, so they pass on an empty
 * syncrecords table.
 *
 * The search term is Khmer on purpose — an ASCII term cannot catch an
 * encoding regression in the request body. See docs/khmer-text.md.
 */
const KHMER_TERM = 'កម្ពុជា';

test.describe('sync-record filename search', () => {
  test('filter trigger opens the search box and Search sends a filename filter', async ({
    page,
  }) => {
    await loginViaUi(page);
    await page.goto('/report/sync-record');
    await expect(page.locator('nz-table')).toBeVisible();

    const searchInput = page.locator('input[placeholder="Search filename"]');
    // The original bug: the dropdown existed but nothing on the page opened it.
    await expect(searchInput).not.toBeVisible();

    const trigger = page.locator('thead nz-filter-trigger');
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(searchInput).toBeVisible();

    await searchInput.fill(KHMER_TERM);
    const [request] = await Promise.all([
      page.waitForRequest(
        (req) =>
          req.url().includes('/report/syncrecords') && req.method() === 'POST',
      ),
      page.getByRole('button', { name: 'Search' }).click(),
    ]);
    const body = request.postDataJSON();
    expect(body.filter).toEqual([{ key: 'filename', value: KHMER_TERM }]);

    // Searching closes the dropdown (component sets visible = false).
    await expect(searchInput).not.toBeVisible();

    // Reset clears the filename filter from the next request.
    await trigger.click();
    const [resetRequest] = await Promise.all([
      page.waitForRequest(
        (req) =>
          req.url().includes('/report/syncrecords') && req.method() === 'POST',
      ),
      page.getByRole('button', { name: 'Reset' }).click(),
    ]);
    expect(resetRequest.postDataJSON().filter).toEqual([]);
  });

  test('API applies the filename filter to the query', async () => {
    // getSyncRecord built a `where` from the filter and then never passed it
    // to findAndCountAll, so every search returned the full table. A filter
    // that matches nothing must return zero rows. (On an empty syncrecords
    // table this passes vacuously either way — it only bites when the
    // environment has sync data, which any real one does.)
    const ctx = await apiContext(await apiLogin());
    const res = await ctx.post('/report/syncrecords', {
      data: {
        pageindex: 1,
        pagesize: 10,
        filter: [{ key: 'filename', value: 'no-such-file-e2e-908172' }],
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.total).toBe(0);
    expect(body.data.data).toEqual([]);
    await ctx.dispose();
  });
});
