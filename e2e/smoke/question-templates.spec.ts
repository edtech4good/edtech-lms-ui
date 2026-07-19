import { expect, test } from '@playwright/test';
import { loginViaUi } from '../fixtures/auth';

/**
 * The authoring template dropdown offers only templates the tablet can render.
 *
 * Twenty-four templates exist server-side: ids 1–8 are the supported set,
 * 18–24 are the working prototypes, and ids 9–17 have no tablet renderer at
 * all — a question saved against one shows the learner an error screen, with
 * no warning to the author (workspace docs/question-types-and-lesson-structure.md).
 * DropDownService filters those nine out of the authoring dropdown; this spec
 * is that decision, enforced. If it goes red, either the filter was removed or
 * a renderer shipped and the filter should shrink.
 *
 * Options are matched by templatename because the label is what an author
 * sees; the total count pins the ids. Prototype names (DOption1, Fraction, …)
 * are deliberately not asserted — Track C will rename them, and a rename
 * should not fail this spec.
 */

// templatename for ids 9–17, verbatim from the API's templatetypes.enum.ts.
const UNSUPPORTED_NAMES = [
  'Q-Text & Audio-A-Audio',
  'Q-Text-A-Audio',
  'Q-Audio-A-Text',
  'Q-Text-A-Image',
  'Q-Audio-A-Audio',
  'Q-Text-A-Text',
  'Q-Image-A-Text',
  'Q-Image-A-Image',
  'Q-Audio-A-Image',
];

// templatename for ids 1–8.
const SUPPORTED_NAMES = [
  'MCQ (Single response) Text and Audio',
  'MCQ (Single response) Picture',
  'MCQ (Multi Correct) Text and Audio',
  'MCQ (Multi Correct) Picture',
  'Correct Ordering (Text sequence)',
  'Correct Ordering (Pic sequence)',
  'Associate',
  'Fill in the blanks',
];

/**
 * Collect every option label from an open nz-select overlay. nz-select renders
 * its options inside a cdk-virtual-scroll viewport, so with enough options
 * only a window of them is in the DOM at once — a single allTextContents()
 * would silently miss the rest, and an absence assertion over it proves
 * nothing. Scroll to the bottom in steps, collecting as we go.
 */
async function collectOpenSelectOptions(page: import('@playwright/test').Page): Promise<Set<string>> {
  const seen = new Set<string>();
  const viewport = page.locator('.cdk-virtual-scroll-viewport');
  await page.locator('.ant-select-item-option-content').first().waitFor();
  for (let i = 0; i < 12; i++) {
    for (const text of await page.locator('.ant-select-item-option-content').allTextContents()) {
      seen.add(text.trim());
    }
    const atBottom = await viewport.evaluate((v) => {
      v.scrollBy(0, 150);
      return v.scrollTop + v.clientHeight >= v.scrollHeight - 1;
    });
    // One settle for the virtual scroller to render the newly visible window.
    await page.waitForTimeout(100);
    if (atBottom) {
      for (const text of await page.locator('.ant-select-item-option-content').allTextContents()) {
        seen.add(text.trim());
      }
      break;
    }
  }
  return seen;
}

// Only the create form is exercised: question-update fills its dropdown from
// the same DropDownService call, so this covers both, and update/:id would
// need a seeded question to exist.
test('template dropdown hides the nine unrenderable templates', async ({ page }) => {
  await loginViaUi(page);
  await page.goto('/question/create');
  await page.click('nz-select[formcontrolname="templatetypeid"]');
  const options = [...(await collectOpenSelectOptions(page))];

  for (const name of SUPPORTED_NAMES) {
    expect(options, `supported template missing: ${name}`).toContain(name);
  }
  for (const name of UNSUPPORTED_NAMES) {
    expect(options, `unrenderable template offered to authors: ${name}`).not.toContain(name);
  }
  // 8 supported + 7 prototypes. Pins the ids without pinning the prototype
  // labels; goes red if the filter over- or under-shoots.
  expect(options.length, `expected 15 templates, saw: ${options.join(', ')}`).toBe(15);
});
