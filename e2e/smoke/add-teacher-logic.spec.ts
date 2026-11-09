import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  FORM_INVALID_MESSAGE,
  PASSWORD_RULE_MESSAGE,
  USERNAME_RULE_MESSAGE,
  USERNAME_TAKEN_MESSAGE,
  type HttpFailure,
} from '../../src/app/modules/student/add-learner/add-learner-form';
import {
  TEACHER_FIELD_ORDER,
  TEACHER_NO_ACCESS_MESSAGE,
  TEACHER_NOT_FOUND_MESSAGE,
  TEACHER_SAVE_FAILED,
  TEACHER_USERNAME_AVAILABLE_MESSAGE,
  teacherServerErrors,
  teacherSignInLine,
} from '../../src/app/modules/teacher/add-teacher/add-teacher-form';

/** The Add teacher drawer's wording and error reading (add-teacher-form.ts), in Node. The drawer in a browser is add-teacher.spec.ts. */
const failure = (status: number, error?: unknown) => ({ status, error }) as HttpFailure;
const root = join(__dirname, '../../src/app/modules');
const text = (file: string) => readFileSync(join(root, file), 'utf8');

test.describe('the sign-in line after a save', () => {
  test('names the username, since a teacher has no name', () => {
    expect(teacherSignInLine({ schoolusername: 'dara1', push: { status: 'pushed' } })).toEqual({
      tone: 'ok',
      text: 'dara1 can sign in on the app now with these details.',
    });
    expect(teacherSignInLine({ schoolusername: 'dara1', push: { status: 'failed' } })).toEqual({
      tone: 'warn',
      text: "dara1 can't sign in yet: the learning server did not answer. Run Sync Teachers for this school on the Schools screen.",
    });
    expect(teacherSignInLine({ schoolusername: 'dara1', push: { status: 'skipped' } })).toEqual({
      tone: 'info',
      text: 'dara1 can sign in once the learning server next syncs.',
    });
  });
  test('says only that the teacher was added when the answer carries no push status', () => {
    expect(teacherSignInLine({ schoolusername: 'dara1' }).text).toBe('dara1 was added.');
    expect(teacherSignInLine({ schoolusername: 'dara1', push: {} }).text).toBe('dara1 was added.');
  });
  test('uses no word for a learner', () => {
    for (const status of ['pushed', 'failed', 'skipped'] as const) {
      expect(teacherSignInLine({ schoolusername: 'dara1', push: { status } }).text.toLowerCase()).not.toContain('learner');
      expect(teacherSignInLine({ schoolusername: 'dara1', push: { status } }).text).not.toContain('Sync Students');
    }
  });
});

test.describe('the API’s answers, as messages beside the fields', () => {
  test('a 400 names username, password and school, each by its body key', () => {
    const read = teacherServerErrors(
      failure(400, {
        code: 'INVALID_INPUT',
        fields: [
          { field: 'schoolusername', message: USERNAME_TAKEN_MESSAGE },
          { field: 'password', message: PASSWORD_RULE_MESSAGE },
          { field: 'schoolid', message: 'Choose an organisation.' },
        ],
      }),
    );
    expect(read).toEqual({ fields: { schoolusername: USERNAME_TAKEN_MESSAGE, password: PASSWORD_RULE_MESSAGE, schoolid: 'Choose an organisation.' } });
  });
  test('a field with no sentence of its own gets the rule', () => {
    const read = teacherServerErrors(failure(400, { fields: [{ field: 'schoolusername' }, { field: 'password' }] }));
    expect(read.fields).toEqual({ schoolusername: USERNAME_RULE_MESSAGE, password: PASSWORD_RULE_MESSAGE });
  });
  test('the username check names its field `username`, and that is the username field', () => {
    expect(teacherServerErrors(failure(400, { fields: [{ field: 'username', message: USERNAME_RULE_MESSAGE }] })).fields).toEqual({
      schoolusername: USERNAME_RULE_MESSAGE,
    });
  });
  test('a 400 that names no field is one message for the form', () => {
    expect(teacherServerErrors(failure(400, { errormessage: 'Choose an organisation.' }))).toEqual({ fields: {}, form: 'Choose an organisation.' });
    expect(teacherServerErrors(failure(400, {}))).toEqual({ fields: {}, form: FORM_INVALID_MESSAGE });
  });
  test('a field a teacher does not have is said for the form, not beside a field that is not there', () => {
    const read = teacherServerErrors(failure(400, { fields: [{ field: 'standard', message: 'Choose a class of this school.' }] }));
    expect(read).toEqual({ fields: {}, form: 'Choose a class of this school.' });
  });
  test('the form-level refusals are worded for a teacher', () => {
    expect(teacherServerErrors(failure(403)).form).toBe(TEACHER_NO_ACCESS_MESSAGE);
    expect(teacherServerErrors(failure(409)).form).toBe(TEACHER_SAVE_FAILED);
    expect(teacherServerErrors(failure(404)).form).toBe(TEACHER_NOT_FOUND_MESSAGE);
    for (const said of [TEACHER_NO_ACCESS_MESSAGE, TEACHER_SAVE_FAILED, TEACHER_NOT_FOUND_MESSAGE, TEACHER_USERNAME_AVAILABLE_MESSAGE]) {
      expect(said.toLowerCase()).not.toContain('learner');
    }
  });
  test('a 404 that names School shows beside School', () => {
    expect(teacherServerErrors(failure(404, { fields: [{ field: 'schoolid', message: "That school doesn't exist." }] }))).toEqual({
      fields: { schoolid: "That school doesn't exist." },
    });
  });
  test('statuses the error interceptor already says (no connection, 429, 500, gateways) add nothing', () => {
    for (const status of [0, 429, 500, 502, 503]) expect(teacherServerErrors(failure(status)), String(status)).toEqual({ fields: {} });
  });
  test('the form has three fields, in the order the first mistake takes focus', () => {
    expect(TEACHER_FIELD_ORDER).toEqual(['schoolusername', 'password', 'schoolid']);
  });
});

test.describe('the wording', () => {
  test('the available line is the design’s', () => {
    expect(TEACHER_USERNAME_AVAILABLE_MESSAGE).toBe('Available. Teachers use this to sign in on the app.');
  });
});

test.describe('the pieces in the templates and the drawer (read as text; the browser spec runs them)', () => {
  test('the drawer asks to discard "this teacher" and shows no learner wording', () => {
    const ts = text('teacher/add-teacher/add-teacher-drawer.component.ts');
    const html = text('teacher/add-teacher/add-teacher-drawer.component.html');
    expect(ts).toContain("nzTitle: 'Discard this teacher?'");
    expect(html).toContain("'Teacher added' : 'Add teacher'");
    expect(html.toLowerCase()).not.toContain('learner');
  });
  test('the body the drawer builds has the three keys and no others', () => {
    const ts = text('teacher/add-teacher/add-teacher-drawer.component.ts');
    const body = ts.match(/const body: AddTeacherBody = \{([^}]*)\}/);
    expect(body).not.toBeNull();
    expect([...(body as RegExpMatchArray)[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1])).toEqual(['schoolid', 'schoolusername', 'password']);
  });
  test('the password lives only inside `done`, which closing clears', () => {
    const ts = text('teacher/add-teacher/add-teacher-drawer.component.ts');
    const forget = ts.slice(ts.indexOf('private forget()'), ts.indexOf('loadSchools(): void'));
    expect(forget).toContain("this.password.set('')");
    expect(forget).toContain('this.done.set(null)');
  });
  test('Add teacher is offered under the same permission and create block as Upload Teachers', () => {
    const html = text('teacher/teacher-index/teacher-index.component.html');
    const group = html.slice(html.indexOf("[ngxPermissionsOnly]=\"['create_teacher']\""), html.indexOf('</ng-template>', html.indexOf('showuploadTeachers()')));
    expect(group).toContain('showAddTeacher()');
    expect(group).toContain('data-testid="add-teacher"');
    const button = group.slice(group.indexOf('showAddTeacher()'), group.indexOf('+ Add teacher'));
    expect(button).toContain('[disabled]="owner.createBlocked()"');
  });
  test('Sync Teachers has the permissions of Sync Students and syncs the school’s teachers', () => {
    const html = text('school/school-index/school-index.component.html');
    const at = html.indexOf('data-testid="sync-teachers"');
    const tag = html.slice(html.lastIndexOf('<a', at), html.indexOf('>Sync Teachers', at));
    expect(tag).toContain(`*ngxPermissionsOnly="['superadmin', 'sync_students']"`);
    expect(tag).toContain('nzPopconfirmTitle="Sure to sync?"');
    expect(tag).toContain('(nzOnConfirm)="synccloudTeachers(data.schoolname)"');
    for (const roleId of ['zr5ER4QD', 'Mapyr2Pw', 'unb3Fy8p', 'Q3Qs7PuD']) expect(tag).not.toContain(roleId);
  });
  test('the service posts to the contract’s two paths', () => {
    const service = readFileSync(join(__dirname, '../../src/app/services/teacher.service.ts'), 'utf8');
    expect(service).toContain('`${this.coreService.CORE_API()}teacher/one`');
    expect(service).toContain('`${this.coreService.CORE_API()}sync/cloud/${schoolname}/teachers`');
  });
});
