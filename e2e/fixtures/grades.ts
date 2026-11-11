/**
 * The grades the mocked API answers for `GET grade/curriculum/:curriculumid` in the learner drawer specs. By default every
 * curriculum has exactly one grade, so a learner is placed without the person choosing; a spec that needs several or none
 * sets `mock.grades[curriculumid]`.
 */
export interface MockGrade {
  gradeid: string;
  gradename: string;
  gradeorder: number;
  curriculumid: string;
  isdeleted: boolean;
}

export const grade = (curriculumid: string, n: number, name = `Grade ${n}`): MockGrade => ({
  gradeid: `gr-${curriculumid}-${n}`,
  gradename: name,
  gradeorder: n,
  curriculumid,
  isdeleted: false,
});

export const oneGrade = (curriculumid: string): MockGrade[] => [grade(curriculumid, 1)];

/** The route's answer: `{ error: false, data: [...] }`, the grades of `grades[curriculumid]` or the one default. */
export function gradesAnswer(grades: Record<string, MockGrade[]>, curriculumid: string) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify({ error: false, data: grades[curriculumid] ?? oneGrade(curriculumid) }) };
}
