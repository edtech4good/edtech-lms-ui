import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Who is offered Sync Students (the school list) and Sync Content (the curriculum list): the permission array each button's
 * template carries, read as text (a directive on an element; a browser test cannot tell a dead entry from an absent one, so
 * the array itself is pinned, as publication-logic.spec.ts does for the wrapper of Sync Content).
 *
 * Decided 31 Oct 2026 (edtech-lms-ui#148, option A): Admin and Organisation Admin may run both for their own organisation,
 * the platform account for any. The API asks for the same two permission names (edtech-lms-api sync.controller.ts). The
 * buttons are in a browser, per role, in sync-buttons.spec.ts.
 */
const SCHOOL_TEMPLATE = join(__dirname, '../../src/app/modules/school/school-index/school-index.component.html');
const CURRICULUM_TEMPLATE = join(__dirname, '../../src/app/modules/curriculum/curriculum-index/curriculum-index.component.html');

/** The opening tag of the element that carries `data-testid="<id>"`. */
const tagWith = (file: string, testid: string): string => {
  const html = readFileSync(file, 'utf8');
  const found = html.match(new RegExp(`<(?:a|span)\\b[^>]*data-testid="${testid}"[^>]*>`));
  expect(found, `${testid} is in the template`).not.toBeNull();
  return (found as RegExpMatchArray)[0];
};

/** The names in the tag's `*ngxPermissionsOnly="[...]"`. */
const allowed = (tag: string): string[] => {
  const array = tag.match(/\*ngxPermissionsOnly="\[([^\]]*)\]"/);
  expect(array, 'the element carries the permission check').not.toBeNull();
  return (array as RegExpMatchArray)[1].split(',').map((n) => n.trim().replace(/^'|'$/g, ''));
};

test.describe('Sync Students on the school list', () => {
  const tag = () => tagWith(SCHOOL_TEMPLATE, 'sync-students');

  test('is offered to superadmin and sync_students only: the permission the API asks for, and no role ids', () => {
    expect(allowed(tag())).toEqual(['superadmin', 'sync_students']);
  });

  test('is the button that syncs students', () => {
    const html = readFileSync(SCHOOL_TEMPLATE, 'utf8');
    const at = html.indexOf('data-testid="sync-students"');
    expect(html.slice(at, at + 400)).toContain('synccloudStudents(data.schoolname)');
  });
});

test.describe('Sync Content on the curriculum list', () => {
  test('is offered to superadmin and sync_content only: the permission the API asks for, and no role ids', () => {
    expect(allowed(tagWith(CURRICULUM_TEMPLATE, 'sync-content-wrap'))).toEqual(['superadmin', 'sync_content']);
  });
});

test.describe('the two buttons', () => {
  test('name no role id anywhere on their elements (a role id is not a permission the API checks)', () => {
    for (const tag of [tagWith(SCHOOL_TEMPLATE, 'sync-students'), tagWith(CURRICULUM_TEMPLATE, 'sync-content-wrap')]) {
      for (const roleId of ['zr5ER4QD', 'Mapyr2Pw', 'unb3Fy8p', 'Q3Qs7PuD']) expect(tag).not.toContain(roleId);
    }
  });
});
