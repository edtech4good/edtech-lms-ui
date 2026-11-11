import { expect, test } from '@playwright/test';
import { serverFieldErrors } from '../../src/app/modules/student/add-learner/add-learner-form';
import { editBody, editErrors, formFromDetails } from '../../src/app/modules/student/edit-learner/edit-learner';
import {
  GRADE_CHOOSE_MESSAGE,
  GRADE_NONE_MESSAGE,
  GradeOption,
  gradeKind,
  gradeMessages,
  gradeOptionsOf,
  gradeProblem,
  gradeToSend,
  primaryCurriculumId,
  reconcileGrade,
  uploadGrade,
} from '../../src/app/modules/student/learner-grade/learner-grade';
import { moveBody, moveErrors } from '../../src/app/modules/student/move-learner/move-learner';
import { uploadEditedStudentsValidationSchema } from '../../src/app/services/validator.service';

/** The grade of a learner on the Add, Edit and Move drawers and Upload Users (learner-grade.ts), in Node. The drawers in a browser are the add/edit/move-learner specs. */
const ONE: GradeOption[] = [{ label: 'Grade 1', value: 'g1' }];
const TWO: GradeOption[] = [
  { label: 'Grade 1', value: 'g1' },
  { label: 'Grade 2', value: 'g2' },
];
const state = (options: GradeOption[]) => ({ kind: gradeKind('ready', options), options });

test.describe('a. one grade', () => {
  test('is shown as text, not a select, and its id is sent', () => {
    expect(gradeKind('ready', ONE)).toBe('one');
    expect(gradeToSend(state(ONE), null)).toBe('g1');
    expect(gradeProblem(state(ONE), null)).toBeNull();
    expect(moveBody('s', 'c', ['cur'], gradeToSend(state(ONE), null))).toEqual({ schoolid: 's', standard: 'c', curriculumids: ['cur'], gradeid: 'g1' });
  });
});

test.describe('b. several grades', () => {
  test('a choice is required: nothing to send and a message until one of the curriculum is chosen', () => {
    expect(gradeKind('ready', TWO)).toBe('several');
    expect(gradeProblem(state(TWO), null)).toBe(GRADE_CHOOSE_MESSAGE);
    expect(gradeProblem(state(TWO), 'other-curriculum-grade')).toBe(GRADE_CHOOSE_MESSAGE);
    expect(gradeToSend(state(TWO), null)).toBeUndefined();
    expect(gradeProblem(state(TWO), 'g2')).toBeNull();
    expect(gradeToSend(state(TWO), 'g2')).toBe('g2');
  });
  test('an edit or move that keeps the primary curriculum may leave it unchosen (the server keeps the current grade) and then sends none', () => {
    expect(gradeProblem(state(TWO), null, true)).toBeNull();
    expect(editBody(formFromDetails(DETAILS), gradeToSend(state(TWO), null))).not.toHaveProperty('gradeid');
  });
  test('the choice goes into the edit body', () => {
    expect(editBody(formFromDetails(DETAILS), gradeToSend(state(TWO), 'g2')).gradeid).toBe('g2');
  });
});

const DETAILS = {
  schooluserid: 'u', schoolusername: 'n', schoolid: 's', schoolname: 'S', studentfirstname: 'Sokha', studentlastname: '', genderid: 1,
  dateofbirth: null, standard: 'c', curriculumids: ['cur-a', 'cur-b'], isdisabled: false,
};

test.describe('c. the current grade and a change of primary curriculum', () => {
  test('is kept while it belongs, else cleared', () => {
    expect(reconcileGrade('g1', TWO)).toBe('g1');
    expect(reconcileGrade('g1', [{ label: 'Other', value: 'x1' }, { label: 'Other 2', value: 'x2' }])).toBeNull();
  });
  test('the learner\'s own grade is preselected when it belongs to the curriculum, and only then', () => {
    expect(reconcileGrade(null, TWO, 'g2')).toBe('g2');
    expect(reconcileGrade(null, TWO, 'not-here')).toBeNull();
  });
  test('the primary curriculum stays the learner\'s while it is chosen, else it is the first', () => {
    expect(primaryCurriculumId(['cur-a', 'cur-b'], 'cur-b')).toBe('cur-b');
    expect(primaryCurriculumId(['cur-a', 'cur-b'], 'cur-gone')).toBe('cur-a');
    expect(primaryCurriculumId([], 'cur-b')).toBeNull();
    expect(primaryCurriculumId(['cur-a', 'cur-b'])).toBe('cur-a');
  });
});

test.describe('d. no grades', () => {
  test('says so under the curriculum at once and blocks a save', () => {
    expect(gradeKind('ready', [])).toBe('none');
    expect(gradeProblem(state([]), null)).toBe(GRADE_NONE_MESSAGE);
    expect(gradeProblem(state([]), null, true)).toBe(GRADE_NONE_MESSAGE);
    expect(gradeMessages('none', GRADE_NONE_MESSAGE, null, false)).toEqual({ underGrade: null, underCurriculum: GRADE_NONE_MESSAGE });
  });
  test('grades that failed to load, or are still loading, also block a save', () => {
    expect(gradeProblem({ kind: 'error', options: [] }, null)).not.toBeNull();
    expect(gradeProblem({ kind: 'loading', options: [] }, null)).not.toBeNull();
  });
});

test.describe('e. the API refuses the grade', () => {
  const refusal = { status: 400, error: { fields: [{ field: 'gradeid', message: 'Choose a grade for this student.' }] } };
  test('add, edit and move each read the 400 on gradeid as the gradeid field', () => {
    expect(serverFieldErrors(refusal).fields.gradeid).toBe('Choose a grade for this student.');
    expect(editErrors(refusal)).toEqual({ fields: { gradeid: 'Choose a grade for this student.' } });
    expect(moveErrors(refusal)).toEqual({ fields: { gradeid: 'Choose a grade for this student.' } });
  });
  test('the message is beside the Grade select when it is shown, else under the curriculum field, never lost', () => {
    const said = 'Choose a grade for this student.';
    expect(gradeMessages('several', null, said, false)).toEqual({ underGrade: said, underCurriculum: null });
    for (const kind of ['one', 'idle', 'error', 'loading'] as const) {
      expect(gradeMessages(kind, null, said, false)).toEqual({ underGrade: null, underCurriculum: said });
    }
  });
});

test.describe('f. Upload Users', () => {
  test('sends the grade as a top-level gradeid, and none when there is none to send', () => {
    expect(uploadGrade(state(ONE), null)).toEqual({ gradeid: 'g1' });
    expect(uploadGrade(state(TWO), 'g2')).toEqual({ gradeid: 'g2' });
    expect(uploadGrade(state(TWO), null)).toEqual({});
    expect(uploadGrade(state([]), null)).toEqual({});
  });
});

test.describe('grades answer', () => {
  test('are read in their order, skipping deleted ones', () => {
    const answer = { data: [
      { gradeid: 'b', gradename: 'Grade 2', gradeorder: 2 },
      { gradeid: 'a', gradename: 'Grade 1', gradeorder: 1 },
      { gradeid: 'x', gradename: 'Old', gradeorder: 0, isdeleted: true },
    ] };
    expect(gradeOptionsOf(answer)).toEqual([{ label: 'Grade 1', value: 'a' }, { label: 'Grade 2', value: 'b' }]);
    expect(gradeOptionsOf(undefined)).toEqual([]);
  });
});

test.describe('Upload Edited Students file', () => {
  const row = {
    studentid: '11111111-1111-4111-8111-111111111111', schooluserid: '22222222-2222-4222-8222-222222222222',
    studentfirstname: 'សុខា', studentlastname: 'ចាន់', genderid: '1', city: 'Town', country: 'Land', state: 'State',
    schoolusername: 'sokha1', dateofjoin: '01-01-2024', isactive: 1, curriculums: 'cur-a',
  };
  test('a row with a grade passes and keeps it in what is posted', () => {
    const rows = [{ ...row, grade: 'Grade 2' }];
    const error = uploadEditedStudentsValidationSchema.validate(rows, { abortEarly: false }).error;
    expect(error?.message).toBeUndefined();
    // the page posts the parsed rows as they are: validate() reads them and changes nothing
    expect(JSON.parse(JSON.stringify(rows))[0].grade).toBe('Grade 2');
  });
  test('a blank grade and a file with no grade column both pass', () => {
    expect(uploadEditedStudentsValidationSchema.validate([{ ...row, grade: '' }]).error).toBeUndefined();
    expect(uploadEditedStudentsValidationSchema.validate([row]).error).toBeUndefined();
  });
  test('a column that is not known is still refused', () => {
    expect(uploadEditedStudentsValidationSchema.validate([{ ...row, nonsense: 'x' }]).error).toBeDefined();
  });
});
