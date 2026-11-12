import { expect, test } from '@playwright/test';
import { isPublicAuthPath } from '../../src/app/services/public-auth-paths';
import {
  Candidate,
  NOT_ON_LEARNING_SERVER,
  Reason,
  offeredTiers,
  pageRule,
  qrDrawing,
  readyIds,
  reasonText,
  refusalText,
  revokeReasonToSend,
  tidyCode,
  verifyUrl,
  whyLines,
  wordingFor,
  lookFor,
  failureText,
  issueSummary,
  NO_CERTIFICATES_MESSAGE,
} from '../../src/app/modules/certificate/certificate';

/** The rules of the certificate screens, in plain Node (certificate.ts): no browser, no API. */
const quiz = (state: 'below' | 'not_taken' | 'unverified', best: number | null, kind: 'lesson' | 'level' = 'level'): Reason => ({
  quiz: { id: 'q', kind, name: kind === 'level' ? 'Module 2 final' : 'Quiz of lesson 3' },
  level: { id: 'lv', name: 'Module 2' },
  ...(kind === 'lesson' ? { lesson: { id: 'ls', name: 'Lesson 3' } } : {}),
  state,
  bestpercent: best,
});

test.describe('which tiers are offered', () => {
  test('only the tiers set to certificate, in level, grade, curriculum order', () => {
    expect(offeredTiers({ levelrecognition: 'certificate', graderecognition: 'certificate', curriculumrecognition: 'certificate' }).map((t) => t.scope)).toEqual(['level', 'grade', 'curriculum']);
    expect(offeredTiers({ levelrecognition: 'award', graderecognition: 'certificate', curriculumrecognition: 'none' }).map((t) => t.scope)).toEqual(['grade']);
    expect(offeredTiers({ levelrecognition: 'award', graderecognition: 'none', curriculumrecognition: 'none' })).toEqual([]);
    expect(offeredTiers({})).toEqual([]);
    expect(offeredTiers(null)).toEqual([]);
    expect(NO_CERTIFICATES_MESSAGE).toBe('This curriculum gives no certificates. Set it under Recognition on the curriculum.');
  });
});

test.describe('the reasons in plain words', () => {
  test('a level quiz reads "<level> quiz", a lesson quiz "<lesson> quiz"', () => {
    expect(reasonText(quiz('below', 60), 'level')).toBe('Module 2 quiz: best 60%');
    expect(reasonText(quiz('not_taken', null, 'lesson'), 'level')).toBe('Lesson 3 quiz: not taken');
    expect(reasonText(quiz('unverified', 90, 'lesson'), 'level')).toBe('Lesson 3 quiz: passed, but the server did not mark it — a retake fixes it');
  });
  test('the two reasons that are not about a quiz', () => {
    expect(reasonText({ reason: 'no_quizzes' }, 'grade')).toBe('No quizzes in this grade');
    expect(reasonText({ reason: 'not_on_learning_server' }, 'grade')).toBe(NOT_ON_LEARNING_SERVER);
    expect(NOT_ON_LEARNING_SERVER).toBe('Not on the learning server yet — sync learners');
  });
  test('ready and issued rows say every quiz passed; a long list is cut with "and N more"', () => {
    expect(whyLines({ status: 'ready', reasons: [] }, 'level')).toEqual(['Every quiz passed']);
    expect(whyLines({ status: 'issued', reasons: [] }, 'level')).toEqual(['Every quiz passed']);
    const five = [quiz('below', 10), quiz('below', 20), quiz('below', 30), quiz('below', 40), quiz('below', 50)];
    expect(whyLines({ status: 'not_yet', reasons: five }, 'level')).toEqual(['Module 2 quiz: best 10%', 'Module 2 quiz: best 20%', 'Module 2 quiz: best 30%', 'and 2 more']);
    expect(whyLines({ status: 'not_yet', reasons: [] }, 'level')).toEqual(['Not every quiz is passed']);
  });
});

test.describe('issuing', () => {
  const row = (id: string, status: Candidate['status']): Candidate => ({ student: { studentid: id, name: id, standardid: null, classname: null }, status, reasons: [], quizcount: 1, passedcount: 1, certificate: null });
  test('"Issue to N ready" sends exactly the ready ids, in table order', () => {
    expect(readyIds([row('a', 'issued'), row('b', 'ready'), row('c', 'not_yet'), row('d', 'cant_check'), row('e', 'ready')])).toEqual(['b', 'e']);
    expect(readyIds([])).toEqual([]);
  });
  test('a refusal reads in words, by its status', () => {
    expect(refusalText({ studentid: 'x', status: 'not_found', reasons: [] }, 'Ana')).toBe('Ana is not enrolled on this curriculum any more.');
    expect(refusalText({ studentid: 'x', status: 'issued', reasons: [] }, 'Ana')).toBe('Ana already has a certificate for this.');
    expect(refusalText({ studentid: 'x', status: 'not_yet', reasons: [] }, 'Ana')).toBe('Ana has not passed every quiz yet.');
    expect(refusalText({ studentid: 'x', status: 'cant_check', reasons: [{ reason: 'not_on_learning_server' }] }, 'Ana')).toBe('Ana is not on the learning server yet.');
    expect(refusalText({ studentid: 'x', status: 'cant_check', reasons: [quiz('unverified', 90)] }, 'Ana')).toBe('Ana could not be checked: a quiz result was not marked by the server.');
  });
  test('the summary counts what was issued', () => {
    expect(issueSummary({ issued: [], refused: [] }, () => 'x').headline).toBe('No certificates were issued.');
    const one = issueSummary({ issued: [{ certificateid: 'c', studentid: 's', shortcode: 'AAAA-BBBB', snapshot: { learnername: 'Ana' } } as never], refused: [] }, () => 'x');
    expect(one.headline).toBe('1 certificate issued.');
    expect(one.issued).toEqual([{ certificateid: 'c', name: 'Ana', shortcode: 'AAAA-BBBB' }]);
  });
});

test.describe('revoking and errors', () => {
  test('a reason is trimmed, and blank or over 500 characters is not sent', () => {
    expect(revokeReasonToSend('  issued by mistake  ')).toBe('issued by mistake');
    expect(revokeReasonToSend('   ')).toBeNull();
    expect(revokeReasonToSend('')).toBeNull();
    expect(revokeReasonToSend('x'.repeat(500))).toHaveLength(500);
    expect(revokeReasonToSend('x'.repeat(501))).toBeNull();
  });
  test('a 502 carries central\'s own sentence; a 403 is a permission line', () => {
    expect(failureText({ status: 502, error: { errormessage: 'The learning server could not be asked. Nothing was changed.' } }, 'x')).toBe('The learning server could not be asked. Nothing was changed.');
    expect(failureText({ status: 502, error: {} }, 'x')).toContain('Nothing was changed');
    expect(failureText({ status: 403 }, 'x')).toBe("You don't have permission to do that.");
    expect(failureText({ status: 500 }, 'fallback')).toBe('fallback');
    expect(failureText({ status: 409, error: { errormessage: 'This certificate has already been revoked.' } }, 'x')).toBe('This certificate has already been revoked.');
  });
});

test.describe('the printed certificate', () => {
  const snap = { tierlabel: 'Module', scopename: 'Pricing and Costs', curriculumname: 'Digital Skills for Small Business' };
  test('the look follows the organisation theme: corporate only when it says so', () => {
    expect(lookFor('corporate')).toBe('corporate');
    for (const other of ['kids', '', null, undefined, 'Corporate']) expect(lookFor(other as string)).toBe('school');
  });
  test('a whole curriculum uses the programme wording, a level or grade names its tier as the snapshot gives it', () => {
    const programme = wordingFor('corporate', 'curriculum', snap);
    expect(programme.subject).toBe('Digital Skills for Small Business');
    expect(programme.intro).toContain('programme');
    expect(programme.partOf).toBe('');
    const part = wordingFor('corporate', 'level', snap);
    expect(part.subject).toBe('Module Pricing and Costs');
    expect(part.partOf).toBe('part of Digital Skills for Small Business');
    expect(part.eyebrow).toBe('Module certificate');
    expect(wordingFor('school', 'grade', snap).title).toBe('Certificate of Achievement');
  });
  test('the page rule is the paper size, landscape', () => {
    expect(pageRule('A4')).toContain('size: A4 landscape');
    expect(pageRule('A3')).toContain('size: A3 landscape');
  });
});

test.describe('the code and the QR', () => {
  test('the QR text is the origin, /v/ and the code', () => {
    expect(verifyUrl('https://admin.example.org', '7F3K-92QD')).toBe('https://admin.example.org/v/7F3K-92QD');
    expect(verifyUrl('https://admin.example.org/', '7F3K-92QD')).toBe('https://admin.example.org/v/7F3K-92QD');
  });
  test('a typed code is tidied to XXXX-XXXX', () => {
    expect(tidyCode('7f3k92qd')).toBe('7F3K-92QD');
    expect(tidyCode(' 7f3k - 92qd ')).toBe('7F3K-92QD');
    expect(tidyCode('7F3K-92QD')).toBe('7F3K-92QD');
    expect(tidyCode('abc')).toBe('ABC');
  });
  test('the QR is drawn: a square grid with dark modules, different text gives a different drawing', () => {
    const a = qrDrawing('https://admin.example.org/v/7F3K-92QD');
    const b = qrDrawing('https://admin.example.org/v/Q2MD-8TXA');
    expect(a.size).toBeGreaterThanOrEqual(25 + 4);
    expect(a.path.startsWith('M')).toBe(true);
    expect(a.path).not.toBe(b.path);
  });
});

test.describe('the public path', () => {
  test('/v and what is under it is public; a longer name is not', () => {
    for (const p of ['/v', '/v/', '/v/7F3K-92QD']) expect(isPublicAuthPath(p), p).toBe(true);
    for (const p of ['/vx', '/verify', '/vv/abc']) expect(isPublicAuthPath(p), p).toBe(false);
  });
});
