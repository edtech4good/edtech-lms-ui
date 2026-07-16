import { Page, expect, test } from '@playwright/test';
import {
  CrudEntity,
  cleanupLeftovers,
  createEntity,
  deleteEntity,
  rowFor,
  seedFor,
  updateEntity,
} from '../fixtures/crud';
import { loginViaUi } from '../fixtures/auth';

/**
 * One CRUD round-trip per entity — ROADMAP Track A, Phase 0.
 *
 * The lazy-module specs prove a module still *renders*. These prove it still
 * *writes*: the reactive form binds, the service posts, the table re-reads, the
 * row updates, the delete lands. That is the half of a page an upgrade rung
 * breaks while everything still looks right on screen.
 *
 * Only entities with no foreign-key prerequisites are covered. grade and level
 * require a curriculum and a grade chosen from nz-selects, which is a different
 * and more brittle interaction — worth adding, but not by pretending it fits
 * this shape.
 */
const ENTITIES: CrudEntity[] = [
  {
    title: 'subject',
    route: 'subject',
    labelField: 'subjectname',
    idField: 'subjectid',
    // subjectname: max 25, min 3. The updated name is not a superset of the
    // created one — rowFor matches on substring, so "e2e subj X upd" would
    // still match a search for "e2e subj X" and the "old name is gone"
    // assertion could never fail.
    create: (s) => ({ subjectname: `e2e subjA ${s}`, subjectdescription: 'e2e smoke suite' }),
    update: (s) => ({ subjectname: `e2e subjB ${s}` }),
  },
  {
    // The same round-trip in Khmer, through the real reactive form. The rest of
    // this suite is ASCII, and ASCII data cannot fail an ASCII-only check —
    // which is how studentfirstname shipped with a joi.alphanum() that rejected
    // every Khmer character. subjectname has no such restriction, so this is a
    // guard against one appearing, and against a charset regression anywhere
    // between the form and MySQL. See docs/khmer-text.md.
    title: 'subject (Khmer)',
    route: 'subject',
    labelField: 'subjectname',
    idField: 'subjectid',
    // 'ខ្មែរ' is 5 codepoints; well inside subjectname's max of 25.
    create: (s) => ({ subjectname: `e2e ខ្មែរA ${s}`, subjectdescription: 'អក្សរខ្មែរ' }),
    update: (s) => ({ subjectname: `e2e ខ្មែរB ${s}` }),
  },
  {
    title: 'document tag',
    route: 'documenttag',
    labelField: 'documenttagname',
    idField: 'documenttagid',
    // Stays ASCII deliberately: documenttagname is alphanum-only and max 8 by
    // design — a short code, not prose. Khmer here would be a test asserting a
    // rule the product does not have.
    // documenttagname: alphanum only, max 8, min 3 — hence no spaces.
    create: (s) => ({ documenttagname: `e2ea${s}` }),
    update: (s) => ({ documenttagname: `e2eb${s}` }),
  },
  {
    title: 'question tag',
    route: 'questiontag',
    labelField: 'questiontagname',
    idField: 'questiontagid',
    // questiontagname: alphanum only, max 8, min 3.
    create: (s) => ({ questiontagname: `e2ea${s}` }),
    update: (s) => ({ questiontagname: `e2eb${s}` }),
  },
];

test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  // One login for the file: the JWT lives in sessionStorage, so it survives
  // navigation within a page but not a new context.
  page = await browser.newPage();
  await loginViaUi(page);
});

test.afterAll(async () => {
  await page?.close();
  // A failing round-trip never reaches its delete step, so sweep up rather than
  // leave e2e rows in the list for good.
  await cleanupLeftovers(ENTITIES);
});

for (const entity of ENTITIES) {
  test(`${entity.title}: create, list, update, delete`, async () => {
    const seed = seedFor();
    const createFields = entity.create(seed);
    const updateFields = entity.update(seed);
    const label = createFields[entity.labelField];
    const updated = updateFields[entity.labelField];

    // CREATE
    await createEntity(page, entity, createFields);

    // READ — the row is really in the table, not just a success toast.
    await expect(
      rowFor(page, label),
      `${entity.title} was created but does not appear in the list`,
    ).toHaveCount(1);

    // UPDATE
    await updateEntity(page, entity, label, updateFields);
    await expect(
      rowFor(page, updated),
      `${entity.title} update did not persist`,
    ).toHaveCount(1);
    await expect(
      rowFor(page, label),
      `${entity.title} still listed under its old name after update`,
    ).toHaveCount(0);

    // DELETE
    await deleteEntity(page, updated);
    await expect(
      rowFor(page, updated),
      `${entity.title} still listed after delete`,
    ).toHaveCount(0);
  });
}
