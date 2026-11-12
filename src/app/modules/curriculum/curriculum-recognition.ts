/**
 * The per-tier recognition setting of a curriculum, as the curriculum form shows it. The values, their lists per tier and the
 * preset defaults are central's (edtech-lms-api src/business/curriculum-recognition.ts): central stores explicit values and
 * refuses any other with a 400 naming the field. Nothing here decides what a value means.
 */
export type RecognitionField = 'levelrecognition' | 'graderecognition' | 'curriculumrecognition';

export interface Recognition {
  levelrecognition: string;
  graderecognition: string;
  curriculumrecognition: string;
}

export const RECOGNITION_FIELDS: readonly RecognitionField[] = ['levelrecognition', 'graderecognition', 'curriculumrecognition'];

export interface RecognitionOption {
  value: string;
  label: string;
}

const NOTHING: RecognitionOption = { value: 'none', label: 'Nothing' };
const AWARD: RecognitionOption = { value: 'award', label: 'Award' };
/** Staff issue certificates on the Certificates page for a tier set to this. */
const CERTIFICATE: RecognitionOption = { value: 'certificate', label: 'Certificate' };

export interface RecognitionTier {
  field: RecognitionField;
  /** The tier's name beside its select (the admin has no tier-label setting, so the plain names). */
  label: string;
  options: readonly RecognitionOption[];
}

/** One row per tier. Only a level can be given an award; a grade and the whole curriculum offer a certificate or nothing. */
export const RECOGNITION_TIERS: readonly RecognitionTier[] = [
  { field: 'levelrecognition', label: 'Level', options: [NOTHING, AWARD, CERTIFICATE] },
  { field: 'graderecognition', label: 'Grade', options: [NOTHING, CERTIFICATE] },
  { field: 'curriculumrecognition', label: 'Curriculum', options: [NOTHING, CERTIFICATE] },
];

export const HELP_REPUBLISH = 'Learners see a change after this curriculum is published again.';
export const HELP_AWARDS_KEPT = 'Switching awards off keeps the awards learners already earned.';
export const HELP_LEVEL_CERTIFICATE = 'No awards are given for this level. Staff issue certificates on the Certificates page.';

/** The defaults of an organisation's preset (central's `recognitionDefaultsFor`): `company` has its own, any other preset is a school's. */
export function recognitionDefaultsFor(preset: string | null | undefined): Recognition {
  return preset === 'company'
    ? { levelrecognition: 'award', graderecognition: 'none', curriculumrecognition: 'certificate' }
    : { levelrecognition: 'award', graderecognition: 'certificate', curriculumrecognition: 'none' };
}

/** What the edit form preselects: the stored value of each tier, null where the curriculum read did not carry it. */
export function storedRecognition(curriculum: Partial<Record<RecognitionField, unknown>> | null | undefined): Record<RecognitionField, string | null> {
  const out = {} as Record<RecognitionField, string | null>;
  for (const field of RECOGNITION_FIELDS) {
    const value = curriculum?.[field];
    out[field] = typeof value === 'string' ? value : null;
  }
  return out;
}

/**
 * Edit sends only the tiers the person changed from what was stored. A tier whose stored value was unknown is sent when it has
 * a value (the person chose it).
 */
export function changedRecognition(stored: Record<RecognitionField, string | null>, now: Record<RecognitionField, string | null>): Partial<Recognition> {
  const out: Partial<Recognition> = {};
  for (const field of RECOGNITION_FIELDS) {
    if (now[field] !== null && now[field] !== stored[field]) out[field] = now[field] as string;
  }
  return out;
}

/** Create sends the three values the form shows; with none known (no preset read) it sends nothing and central fills the defaults. */
export function recognitionToCreate(now: Record<RecognitionField, string | null>, known: boolean): Partial<Recognition> {
  if (!known) return {};
  const out: Partial<Recognition> = {};
  for (const field of RECOGNITION_FIELDS) if (now[field] !== null) out[field] = now[field] as string;
  return out;
}

/** A level set to Certificate gives no awards and no certificate yet: the form says so. */
export const showsLevelCertificateNote = (levelrecognition: string | null): boolean => levelrecognition === 'certificate';

export interface RecognitionFailure {
  status?: number;
  error?: unknown;
}

export interface FailureReading {
  /** The ng-zorro key of the toast when the interceptor's own notice for it has one (a 404), so a repeat replaces the one showing. */
  toastKey?: string;
  /** The API's sentence for each recognition field it named, shown beside that select. */
  fields: Partial<Record<RecognitionField, string>>;
  /** The sentence for a toast when a 400 names another field, or a 403 or 404 (which the opt-out silenced); null when nothing is left to say. */
  toast: string | null;
}

/**
 * What a refused create or update means for the form. A 400 is `{ error, code: 'INVALID_INPUT', errormessage, hint, fields: [{ field, message }] }`
 * (central's validator): a field of the three shows its message beside its select; any other field's 400 is a toast with the API's
 * sentence, as before. `notFoundKey` is the interceptor's own 404 de-duplication key (passed in so this file stays free of Angular). The caller opts out of the interceptor's own toasts for these requests, so this says everything once.
 */
export function readFailure(failure: RecognitionFailure, notFoundKey?: string): FailureReading {
  const out: FailureReading = { fields: {}, toast: null };
  const status = failure.status ?? 0;
  const body = (failure.error && typeof failure.error === 'object' ? failure.error : {}) as { errormessage?: unknown; fields?: unknown };
  const said = typeof body.errormessage === 'string' && body.errormessage.trim() ? body.errormessage : null;
  if (status === 400) {
    let other = false;
    for (const f of Array.isArray(body.fields) ? (body.fields as Array<{ field?: unknown; message?: unknown }>) : []) {
      const key = RECOGNITION_FIELDS.find((k) => k === f?.field);
      if (!key) {
        other = true;
      } else if (!out.fields[key]) {
        out.fields[key] = typeof f.message === 'string' && f.message.trim() ? f.message : 'Choose one of the options.';
      }
    }
    if (Object.keys(out.fields).length === 0 || other) out.toast = said ?? 'Some of the information is not valid.';
    return out;
  }
  // The interceptor still says 0, 429, 500 and a gateway failure; FIELD_ERRORS_INLINE silences only a 400, a 403 and a 404.
  if (status === 403) out.toast = "You don't have permission to do that.";
  else if (status === 404) {
    out.toast = said ?? 'That record was not found. It may have been removed, or it may not be yours to see.';
    out.toastKey = notFoundKey;
  } else if (status === 409) {
    // A duplicate curriculum name (central: 409 ALREADY_EXISTS, "That curriculum already exists."). The interceptor has no 409 branch.
    out.toast = said ?? 'That curriculum already exists.';
  }
  return out;
}
