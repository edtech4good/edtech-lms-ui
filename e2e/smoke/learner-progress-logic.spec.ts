import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  currentModuleLabel,
  lastActive,
  modulesLabel,
  progressLabel,
} from '../../src/app/modules/report/learner-progress/learner-progress.format';
import { LEARNER_PROGRESS_PERMISSIONS, REPORT_HUB, hubLinkVisible, hubSectionVisible, holdsAll } from '../../src/app/modules/shell/shell-nav.config';

/**
 * Reports > Learner progress, the parts that are plain logic: the words in the cells, and who is offered the link.
 * Pure functions, run in plain Node; the screen against a real stack is checked by hand.
 */

test.describe('Learner progress: the words in the cells', () => {
  test('progress reads "N of M lessons · P%", with the API percent', () => {
    expect(progressLabel({ lessonsCompleted: 12, lessonsTotal: 40, percent: 30 })).toBe('12 of 40 lessons · 30%');
    // The percent is shown as given, never recomputed (the API rounds a nearly-done learner down to 99).
    expect(progressLabel({ lessonsCompleted: 39, lessonsTotal: 40, percent: 99 })).toBe('39 of 40 lessons · 99%');
  });

  test('a curriculum with no lessons shows a dash', () => {
    expect(progressLabel({ lessonsCompleted: 0, lessonsTotal: 0, percent: 0 })).toBe('—');
    expect(currentModuleLabel({ currentLevel: null, lessonsTotal: 0 })).toBe('—');
    expect(modulesLabel({ levelsCompleted: 0, levelsTotal: 0 })).toBe('—');
  });

  test('current module: its name; "Finished" when there is none but the curriculum has lessons', () => {
    expect(currentModuleLabel({ currentLevel: null, lessonsTotal: 40 })).toBe('Finished');
    expect(currentModuleLabel({ currentLevel: { levelid: 'l1', levelname: 'Module 3' }, lessonsTotal: 40 })).toBe('Module 3');
  });

  test('modules read "completed of total"', () => {
    expect(modulesLabel({ levelsCompleted: 2, levelsTotal: 6 })).toBe('2 of 6');
  });

  test('last active is the later of last sign-in and last progress; null (shown "Never") when neither', () => {
    const iso = (d: Date | null) => d?.toISOString();
    expect(iso(lastActive('2026-11-20T12:00:00Z', '2026-11-25T12:00:00Z'))).toBe('2026-11-25T12:00:00.000Z');
    expect(iso(lastActive('2026-11-26T12:00:00Z', '2026-11-25T12:00:00Z'))).toBe('2026-11-26T12:00:00.000Z');
    expect(iso(lastActive('2026-11-20T12:00:00Z', null))).toBe('2026-11-20T12:00:00.000Z');
    expect(iso(lastActive(null, '2026-11-25T12:00:00Z'))).toBe('2026-11-25T12:00:00.000Z');
    expect(lastActive(null, null)).toBeNull();
  });
});

test.describe('Learner progress: who is offered the link', () => {
  const link = () => {
    const found = REPORT_HUB.find((s) => s.key === 'online')?.links.find((l) => l.route === '/report/learner-progress');
    expect(found, 'the hub has a Learner progress link').toBeDefined();
    return found!;
  };

  test('it is the first link of the online section, labelled Learner progress', () => {
    const online = REPORT_HUB.find((s) => s.key === 'online')!;
    expect(online.links[0].label).toBe('Learner progress');
    expect(online.links[0].route).toBe('/report/learner-progress');
  });

  test('shown only with all four: view_online_report, view_student, view_school, view_standard', () => {
    const four = ['view_online_report', 'view_student', 'view_school', 'view_standard'];
    expect(hubLinkVisible(link(), ['view_online_report'])).toBe(false);
    expect(hubLinkVisible(link(), ['view_student'])).toBe(false);
    for (const missing of four) expect(hubLinkVisible(link(), four.filter((k) => k !== missing)), `without ${missing}`).toBe(false);
    expect(hubLinkVisible(link(), [...four, 'view_teacher'])).toBe(true);
    expect(hubLinkVisible(link(), [])).toBe(false);
  });

  test('superadmin (the synthetic permission) is offered it', () => {
    expect(hubLinkVisible(link(), ['superadmin'])).toBe(true);
  });

  test('a link without requireAll is still any-of', () => {
    const quiz = REPORT_HUB.find((s) => s.key === 'online')!.links.find((l) => l.label === 'Active status')!;
    expect(hubLinkVisible(quiz, ['view_online_active_status'])).toBe(true);
    expect(hubLinkVisible(quiz, ['view_student'])).toBe(false);
  });

  test('a section shows when one of its links does, and hides when none does', () => {
    const online = REPORT_HUB.find((s) => s.key === 'online')!;
    // view_online_report alone still opens the section: the Awards link is on it (any-of).
    expect(hubSectionVisible(online, ['view_online_report'])).toBe(true);
    expect(hubSectionVisible(online, ['view_student'])).toBe(false);
    expect(hubSectionVisible(online, ['view_online_report', 'view_student', 'view_school', 'view_standard'])).toBe(true);
  });

  test('the link adds nothing to the any-of lists: the online section and the Reports item are what they were', () => {
    expect(link().permissions).toEqual([]);
    const online = REPORT_HUB.find((s) => s.key === 'online')!;
    expect(online.permissions).not.toContain('view_student');
    expect(online.permissions).toContain('view_online_active_status');
  });

  test('an empty all-of list never shows a link, even for superadmin; and the guard refuses with no keys', () => {
    expect(holdsAll(['superadmin', 'a'], [])).toBe(false);
    const guard = readFileSync(join(__dirname, '../../src/app/guards/permission.guard.ts'), 'utf8');
    expect(guard).toMatch(/keys\.length === 0\) return router\.createUrlTree\(\['\/un-authorized'\]\)/);
  });

  test('the Awards links stay any-of, on their own permissions', () => {
    const awards = REPORT_HUB.flatMap((s) => s.links).filter((l) => l.label === 'Awards');
    expect(awards.length).toBe(2);
    for (const a of awards) {
      expect(a.requireAll).toBeUndefined();
      expect(hubLinkVisible(a, ['view_student'])).toBe(false);
    }
    expect(hubLinkVisible(awards[0], ['view_offline_report'])).toBe(true);
    expect(hubLinkVisible(awards[1], ['view_online_report'])).toBe(true);
  });

  test('holdsAll needs every key', () => {
    expect(holdsAll(['a'], ['a', 'b'])).toBe(false);
    expect(holdsAll(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  test('the route is guarded by both permissions, and calls central\'s online learner-progress path', () => {
    const routing = readFileSync(join(__dirname, '../../src/app/modules/report/report-routing.module.ts'), 'utf8');
    expect(routing).toMatch(/path: 'learner-progress'[\s\S]*?requireAllPermissions\(\.\.\.LEARNER_PROGRESS_PERMISSIONS\)/);
    expect(LEARNER_PROGRESS_PERMISSIONS).toEqual(['view_online_report', 'view_student', 'view_school', 'view_standard']);
    const service = readFileSync(join(__dirname, '../../src/app/services/report.service.ts'), 'utf8');
    expect(service).toContain('report/online/learner-progress');
  });
});
