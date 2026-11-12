import qrcode from 'qrcode-generator';

/**
 * Certificates, slice 1: the shapes central answers (edtech-lms-api src/modules/certificate, src/business/certificate.business.ts)
 * and the plain-language rules of the screens, kept free of Angular so the logic specs can run them in Node.
 * Whether a learner may be certified is the learning server's answer, relayed by central; nothing here decides it.
 */

export type CertificateScope = 'level' | 'grade' | 'curriculum';
export type CandidateStatus = 'issued' | 'ready' | 'not_yet' | 'cant_check';

/** A quiz the learner has not passed, as the learning server reports it. */
export interface QuizReason {
  quiz: { id: string; kind: 'lesson' | 'level'; name: string };
  level: { id: string; name: string };
  lesson?: { id: string; name: string };
  state: 'below' | 'not_taken' | 'unverified';
  bestpercent: number | null;
}
/** The two reasons that are not about one quiz. */
export interface SpecialReason {
  reason: 'no_quizzes' | 'not_on_learning_server';
}
export type Reason = QuizReason | SpecialReason;

export interface Candidate {
  student: { studentid: string; name: string; standardid: string | null; classname: string | null };
  status: CandidateStatus;
  reasons: Reason[];
  quizcount: number;
  passedcount: number;
  certificate: { certificateid: string; shortcode: string; issuedat: string } | null;
}

export interface CertificateSnapshot {
  learnername: string;
  curriculumname: string;
  scopename: string;
  tierlabel: string;
  classname: string | null;
  organisationname: string;
  schoolname: string;
  quizcount: number;
}

/** A certificate as staff read it (`GET certificate/:id`, and each entry of `issued` and of `certificate/student/:id`). */
export interface CertificateRecord {
  certificateid: string;
  shortcode: string;
  organisationid: string;
  studentid: string;
  curriculumid: string;
  scope: CertificateScope;
  scopeid: string;
  standardid: string | null;
  issuedat: string;
  issuedby: string;
  revokedat: string | null;
  revokedby: string | null;
  revokereason: string | null;
  snapshot: CertificateSnapshot;
}

export interface Refusal {
  studentid: string;
  status: string;
  reasons: Reason[];
}
export interface IssueAnswer {
  issued: CertificateRecord[];
  refused: Refusal[];
}

/** What the public check answers (`GET certificates/verify/:shortcode`). */
export interface VerifyValid {
  status: 'valid';
  learnername: string;
  scope: CertificateScope;
  tierlabel: string;
  scopename: string;
  curriculumname: string;
  classname: string | null;
  organisationname: string;
  issuedat: string;
  shortcode: string;
}
export interface VerifyRevoked {
  status: 'revoked';
  revokedat: string;
  shortcode: string;
}
export type VerifyAnswer = VerifyValid | VerifyRevoked;

// ---- The permissions -------------------------------------------------------

export const LIST_CERTIFICATE = 'list_certificate';
export const CREATE_CERTIFICATE = 'create_certificate';
export const REVOKE_CERTIFICATE = 'revoke_certificate';
/** ngx-permissions reads an array as OR; `superadmin` is the platform account's synthetic permission. Stable arrays (see sidebarPerm). */
export const LIST_CERTIFICATE_PERMISSIONS = [LIST_CERTIFICATE, 'superadmin'];
export const CREATE_CERTIFICATE_PERMISSIONS = [CREATE_CERTIFICATE, 'superadmin'];
export const REVOKE_CERTIFICATE_PERMISSIONS = [REVOKE_CERTIFICATE, 'superadmin'];

// ---- Which tiers can be certified -------------------------------------------

/** The recognition settings of a curriculum, as the curriculum list carries them. */
export interface RecognitionSettings {
  levelrecognition?: string | null;
  graderecognition?: string | null;
  curriculumrecognition?: string | null;
}

export interface CertificateTier {
  scope: CertificateScope;
  field: keyof RecognitionSettings;
  /** The tier's name beside its pick (the admin has no tier-label setting, so the plain names the Recognition section uses). */
  label: string;
  /** Lower case, for a sentence: "No quizzes in this level". */
  noun: string;
}

export const CERTIFICATE_TIERS: readonly CertificateTier[] = [
  { scope: 'level', field: 'levelrecognition', label: 'Level', noun: 'level' },
  { scope: 'grade', field: 'graderecognition', label: 'Grade', noun: 'grade' },
  { scope: 'curriculum', field: 'curriculumrecognition', label: 'Curriculum', noun: 'curriculum' },
];

export const NO_CERTIFICATES_MESSAGE = 'This curriculum gives no certificates. Set it under Recognition on the curriculum.';

/** Only the tiers the curriculum sets to `certificate`; none means the page says NO_CERTIFICATES_MESSAGE. */
export function offeredTiers(curriculum: RecognitionSettings | null | undefined): CertificateTier[] {
  if (!curriculum) return [];
  return CERTIFICATE_TIERS.filter((tier) => curriculum[tier.field] === 'certificate');
}

export const tierOf = (scope: CertificateScope): CertificateTier => CERTIFICATE_TIERS.find((t) => t.scope === scope) as CertificateTier;

// ---- The table --------------------------------------------------------------

export const STATUS_LABEL: Record<CandidateStatus, string> = {
  issued: 'Issued',
  ready: 'Ready',
  not_yet: 'Not yet',
  cant_check: "Can't check",
};

/** How many reasons a row lists before "and N more". */
export const REASON_LIMIT = 3;
export const EVERY_QUIZ_PASSED = 'Every quiz passed';
export const NOT_ON_LEARNING_SERVER = 'Not on the learning server yet — sync learners';

const isQuizReason = (reason: Reason): reason is QuizReason => (reason as QuizReason).quiz !== undefined;

/** "Module 2 quiz" for a level quiz, "<lesson name> quiz" for a lesson quiz. */
export function quizLabel(reason: QuizReason): string {
  const name = reason.quiz.kind === 'lesson' ? (reason.lesson?.name ?? reason.quiz.name) : reason.level.name;
  return `${name} quiz`;
}

/** One reason in plain words. `noun` is the tier being certified, for "No quizzes in this level". */
export function reasonText(reason: Reason, noun: string): string {
  if (!isQuizReason(reason)) {
    return reason.reason === 'no_quizzes' ? `No quizzes in this ${noun}` : NOT_ON_LEARNING_SERVER;
  }
  const label = quizLabel(reason);
  switch (reason.state) {
    case 'below':
      return `${label}: best ${Math.round(Number(reason.bestpercent ?? 0))}%`;
    case 'unverified':
      return `${label}: passed, but the server did not mark it — a retake fixes it`;
    default:
      return `${label}: not taken`;
  }
}

/**
 * The "Why" cell of a row: what is left, one line each (at most REASON_LIMIT, then "and N more"). A ready or issued learner has
 * passed everything; a row the server gave no reason for still says something.
 */
export function whyLines(candidate: Pick<Candidate, 'status' | 'reasons'>, noun: string, limit = REASON_LIMIT): string[] {
  if (candidate.status === 'issued' || candidate.status === 'ready') return [EVERY_QUIZ_PASSED];
  const reasons = Array.isArray(candidate.reasons) ? candidate.reasons : [];
  if (reasons.length === 0) return ['Not every quiz is passed'];
  const lines = reasons.slice(0, limit).map((r) => reasonText(r, noun));
  if (reasons.length > limit) lines.push(`and ${reasons.length - limit} more`);
  return lines;
}

/** The ids "Issue to N ready" sends: exactly the rows that are ready, in table order. */
export const readyIds = (candidates: readonly Candidate[]): string[] => candidates.filter((c) => c.status === 'ready').map((c) => c.student.studentid);

export const issueAllLabel = (n: number): string => `Issue to ${n} ready`;

// ---- After an issue ----------------------------------------------------------

/** A refused learner in words. `reasons` can say it is the learner's missing sync. */
export function refusalText(refusal: Refusal, name: string): string {
  let why: string;
  switch (refusal.status) {
    case 'not_found':
      why = 'is not enrolled on this curriculum any more';
      break;
    case 'issued':
      why = 'already has a certificate for this';
      break;
    case 'not_yet':
      why = 'has not passed every quiz yet';
      break;
    case 'cant_check':
      why = (refusal.reasons ?? []).some((r) => !isQuizReason(r) && r.reason === 'not_on_learning_server')
        ? 'is not on the learning server yet'
        : 'could not be checked: a quiz result was not marked by the server';
      break;
    default:
      why = 'could not be issued a certificate';
  }
  return `${name} ${why}.`;
}

export interface IssueSummary {
  /** "2 certificates issued." */
  headline: string;
  issued: Array<{ certificateid: string; name: string; shortcode: string }>;
  refusals: string[];
}

export function issueSummary(answer: IssueAnswer, nameOf: (studentid: string) => string): IssueSummary {
  const issued = (answer.issued ?? []).map((c) => ({ certificateid: c.certificateid, name: c.snapshot?.learnername || nameOf(c.studentid), shortcode: c.shortcode }));
  const refused = answer.refused ?? [];
  return {
    headline: issued.length === 0 ? 'No certificates were issued.' : `${issued.length} ${issued.length === 1 ? 'certificate' : 'certificates'} issued.`,
    issued,
    refusals: refused.map((r) => refusalText(r, nameOf(r.studentid))),
  };
}

// ---- Revoking ------------------------------------------------------------------

export const MAX_REVOKE_REASON = 500;
/** The reason as it is sent: trimmed. Empty (or longer than the API takes) is not sent. */
export function revokeReasonToSend(text: string): string | null {
  const trimmed = (text ?? '').trim();
  return trimmed.length >= 1 && trimmed.length <= MAX_REVOKE_REASON ? trimmed : null;
}

// ---- Errors --------------------------------------------------------------------

export const LOAD_FAILED = 'The learners could not be loaded. Try again in a moment.';
export const FORBIDDEN = "You don't have permission to do that.";

/**
 * One plain sentence for a failed request: a permission line for a 403, the API's own sentence for a 400 and a 409, else the
 * fallback. A 502 or 503 is worded by `gatewayText` (certificate-errors.ts), which the interceptor uses too.
 */
export function failureText(error: { status?: number; error?: { errormessage?: unknown; hint?: unknown } } | null | undefined, fallback: string): string {
  const said = typeof error?.error?.errormessage === 'string' ? error.error.errormessage.trim() : '';
  const status = error?.status;
  if (status === 403) return FORBIDDEN;
  if ((status === 400 || status === 409) && said) return said;
  return fallback;
}

// ---- Which levels and grades are offered ------------------------------------------

export interface ScopeOption {
  id: string;
  label: string;
}
/** Central's curriculum tree carries deleted and switched-off rows too; a grade or level is offered only when it is live. */
const live = (row: { isdeleted?: boolean; gradestatus?: boolean; levelstatus?: boolean } | null | undefined): boolean =>
  !!row && row.isdeleted !== true && row.gradestatus !== false && row.levelstatus !== false;

/**
 * The grades (scope 'grade'), or the levels (scope 'level', each with its grade's name when more than one grade is live) of one
 * curriculum tree. A deleted or switched-off grade or level is left out, and so are the levels under a dropped grade.
 */
export function scopeOptionsFrom(tree: any, scope: CertificateScope | null): ScopeOption[] {
  const grades: any[] = (Array.isArray(tree?.grades) ? tree.grades : []).filter(live);
  if (scope === 'grade') return grades.map((g) => ({ id: g.gradeid, label: g.gradename }));
  return grades.flatMap((g) =>
    (Array.isArray(g.levels) ? g.levels : []).filter(live).map((l: any) => ({ id: l.levelid, label: grades.length > 1 ? `${l.levelname} (${g.gradename})` : l.levelname })),
  );
}

// ---- Issuing in batches ---------------------------------------------------------------

/** Central takes at most this many learners in one issue. */
export const ISSUE_BATCH = 200;
export function inBatches<T>(items: readonly T[], size = ISSUE_BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
export const mergeIssued = (answers: readonly IssueAnswer[]): IssueAnswer => ({
  issued: answers.flatMap((a) => a.issued ?? []),
  refused: answers.flatMap((a) => a.refused ?? []),
});

// ---- The certificate page ------------------------------------------------------

export type CertificateLook = 'corporate' | 'school';
/** Corporate when the organisation's UI theme says so; anything else (including no answer) is the school look. */
export const lookFor = (uitheme: string | null | undefined): CertificateLook => (uitheme === 'corporate' ? 'corporate' : 'school');

export type PaperSize = 'A4' | 'A3';
export const pageRule = (size: PaperSize): string => `@page { size: ${size} landscape; margin: 0; }`;

export interface CertificateWording {
  /** The small line above the title, corporate only. */
  eyebrow: string;
  title: string;
  given: string;
  /** "has completed every module of the programme and passed each quiz at 80% or more:" */
  intro: string;
  /** The bold name of what was completed. */
  subject: string;
  /** The line after the subject, when the certificate is for a part of a curriculum. */
  partOf: string;
}

/**
 * The wording of the printed certificate, from the snapshot. The whole curriculum uses the programme wording (C1); a level or a
 * grade names its tier as the snapshot gives it ("<tierlabel> <scopename>", nothing invented) and the programme it belongs to
 * (C2). The school look is S1 whichever the scope.
 */
export function wordingFor(look: CertificateLook, scope: CertificateScope, snapshot: Pick<CertificateSnapshot, 'tierlabel' | 'scopename' | 'curriculumname'>): CertificateWording {
  // the sentence names the level or grade by its own name; the tier is only in the eyebrow
  const part = snapshot.scopename;
  if (look === 'school') {
    return scope === 'curriculum'
      ? { eyebrow: '', title: 'Certificate of Achievement', given: 'This is presented to', intro: 'for completing', subject: snapshot.curriculumname, partOf: '' }
      : { eyebrow: '', title: 'Certificate of Achievement', given: 'This is presented to', intro: 'for completing', subject: part, partOf: `part of ${snapshot.curriculumname}` };
  }
  return scope === 'curriculum'
    ? {
        eyebrow: 'Certificate of completion',
        title: 'Certificate of Completion',
        given: 'This certifies that',
        intro: 'has completed every part of the programme and passed each quiz at 80% or more:',
        subject: snapshot.curriculumname,
        partOf: '',
      }
    : {
        eyebrow: `${snapshot.tierlabel} certificate`,
        title: 'Certificate of Completion',
        given: 'This certifies that',
        intro: 'has completed and passed the quizzes of',
        subject: part,
        partOf: `part of ${snapshot.curriculumname}`,
      };
}

/** "12 November 2026" in English; the instant is shown in the viewer's own time zone. */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "12 Nov 2026" for a table. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const isRevoked = (certificate: Pick<CertificateRecord, 'revokedat'> | null | undefined): boolean => !!certificate?.revokedat;

// ---- The code and the QR --------------------------------------------------------

/** What the QR encodes: where the public check page for this code lives on this admin's origin. */
export const verifyUrl = (origin: string, shortcode: string): string => `${origin.replace(/\/+$/, '')}/v/${shortcode}`;

/**
 * Turns what a person typed on the check page into the code the route takes: spaces and dashes out, upper case, shaped XXXX-XXXX.
 * Central normalises again and answers the same 404 for anything that is not a code, so this only tidies; it returns the cleaned
 * text unchanged in shape when it is not eight characters, and the page then asks central anyway.
 */
export function tidyCode(typed: string): string {
  const letters = (typed ?? '').replace(/[\s-]+/g, '').toUpperCase();
  return letters.length === 8 ? `${letters.slice(0, 4)}-${letters.slice(4)}` : letters;
}

/** A QR as one SVG path (one square per dark module), with a quiet zone of `margin` modules; `size` is the side in modules. */
export interface QrDrawing {
  size: number;
  path: string;
}
export function qrDrawing(text: string, margin = 2): QrDrawing {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) path += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
  }
  return { size: count + margin * 2, path };
}
