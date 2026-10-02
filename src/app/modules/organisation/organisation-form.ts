import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorBody, OrganisationBranding } from './organisation.model';

/** The five tile colours (design o2). White text is at least 4.5:1 on each. */
export const SWATCHES = [
  { name: 'Teal', colour: '#0B7C85' },
  { name: 'Blue', colour: '#0B5FFF' },
  { name: 'Violet', colour: '#6D5BD0' },
  { name: 'Green', colour: '#0B6B45' },
  { name: 'Ink', colour: '#1E293B' },
] as const;

export const DEFAULT_TILE_COLOUR: string = SWATCHES[0].colour;

export type FieldKey = 'organisationname' | 'organisationshortname' | 'organisationcode' | 'countryids';

export const NAME_MAX = 250;
export const CODE_MIN = 2;
export const CODE_MAX = 16;
export const SHORTNAME_MAX_GRAPHEMES = 3;
const SHORTNAME_MAX_CODE_POINTS = 12;

/** One letter, then letters and combining marks (Khmer vowel signs and subscripts are marks). */
const SHORTNAME_PATTERN = /^\p{L}[\p{L}\p{M}]*$/u;
const CODE_PATTERN = /^[a-z0-9]+$/;

/** Visible letters (grapheme clusters), not code points: a Khmer cluster such as "សុ" is one. */
export function countGraphemes(value: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return [...segmenter.segment(value)].length;
}

export function nameError(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter a name.';
  if (v.length > NAME_MAX) return `Use ${NAME_MAX} characters or fewer.`;
  return null;
}

/** The API's rule: a letter, then letters and marks; 1 to 3 clusters; at most 12 code points. */
export function shortNameError(value: string): string | null {
  if (!value) return 'Enter a short name.';
  if (!SHORTNAME_PATTERN.test(value)) return 'Use letters only, starting with a letter.';
  if (countGraphemes(value) > SHORTNAME_MAX_GRAPHEMES) {
    return `Use ${SHORTNAME_MAX_GRAPHEMES} letters or fewer.`;
  }
  // Few enough letters, but built from too many characters (stacked marks): the
  // API refuses it, and "use 3 letters or fewer" would be untrue.
  if ([...value].length > SHORTNAME_MAX_CODE_POINTS) {
    return 'That short name is too long. Use simpler letters.';
  }
  return null;
}

export function codeError(value: string): string | null {
  if (!value) return 'Enter a code.';
  if (!CODE_PATTERN.test(value)) return 'Use lowercase letters and digits only.';
  if (value.length < CODE_MIN || value.length > CODE_MAX) return `Use ${CODE_MIN} to ${CODE_MAX} characters.`;
  return null;
}

export function countriesError(ids: readonly string[]): string | null {
  return ids.length === 0 ? 'Choose at least one country.' : null;
}

/** What the screen shows for each field the API names (our words, not the API's). */
const FIELD_MESSAGES: Record<FieldKey, string> = {
  organisationname: "That name isn't valid. Check it and try again.",
  organisationshortname: 'Use 3 letters or fewer, starting with a letter.',
  organisationcode: 'Use 2 to 16 lowercase letters and digits.',
  countryids: 'Choose countries that exist, each only once.',
};

export interface ServerFieldErrors {
  fields: Partial<Record<FieldKey, string>>;
  /** Something that belongs to no field (a missing organisation, a refusal). */
  form?: string;
}

/** Shown when a save failed and the API gave nothing more specific. */
/**
 * A 403 from the organisation API: the person holds an organisation permission but is
 * not platform staff. Said the same way on the list, in the form and in a toast.
 */
export const NO_ACCESS_HEADING = "You don't have access to organisations.";
export const NO_ACCESS_LINE = 'Organisations are managed by platform staff.';

export const SAVE_FAILED = "The organisation couldn't be saved. Try again.";

/**
 * Statuses the error interceptor already puts in a toast (429, 500, and no
 * connection). Saying it again beside the form would be a second message.
 */
const TOASTED_BY_INTERCEPTOR: readonly number[] = [0, 429, 500];

/** The API's own sentences for a 409 (edtech-lms-api, organisation.business.validator.ts and organisation.business.ts). */
const API_NAME_IN_USE = 'That organisation name is already in use.';
const API_CODE_IN_USE = 'That organisation code is already in use.';
const API_COUNTRY_HAS_SCHOOLS = 'A school of this organisation is in a country you are removing.';

/**
 * Turn a failed create or update into messages beside the fields, or one for the
 * form. Every failure the interceptor does not toast says something here.
 *
 * - A 400 names its fields.
 * - A 409 names none; the API's sentence says which rule was broken. The name and
 *   code sentences go to those fields (both, if both are in the message), the
 *   countries sentence to Countries, and any other 409 shows the API's own message
 *   for the form (it is written for users), or the generic line when it has none.
 * - Anything else (401, 502, 503, ...) is the generic line.
 */
export function serverFieldErrors(error: HttpErrorResponse): ServerFieldErrors {
  const body = (error.error ?? {}) as ApiErrorBody;
  const out: ServerFieldErrors = { fields: {} };
  if (TOASTED_BY_INTERCEPTOR.includes(error.status)) {
    return out;
  }
  if (error.status === 400 && body.fields?.length) {
    for (const f of body.fields) {
      if (f.field in FIELD_MESSAGES) {
        out.fields[f.field as FieldKey] = FIELD_MESSAGES[f.field as FieldKey];
      } else {
        out.form = "Some of the information isn't valid. Check the form and try again.";
      }
    }
    return out;
  }
  if (error.status === 409) {
    const message = typeof body.errormessage === 'string' ? body.errormessage : '';
    if (message.includes(API_NAME_IN_USE)) {
      out.fields.organisationname = 'That name is already in use. Use a different name.';
    }
    if (message.includes(API_CODE_IN_USE)) {
      out.fields.organisationcode = 'That code is already in use. Codes can never be reused.';
    }
    if (message.includes(API_COUNTRY_HAS_SCHOOLS)) {
      out.fields.countryids = API_COUNTRY_HAS_SCHOOLS;
    }
    if (Object.keys(out.fields).length === 0) {
      out.form = message.trim() ? message : SAVE_FAILED;
    }
    return out;
  }
  if (error.status === 404) {
    out.form = 'That organisation no longer exists.';
  } else if (error.status === 403) {
    out.form = `${NO_ACCESS_HEADING} ${NO_ACCESS_LINE}`;
  } else if (error.status === 400) {
    out.form = "Some of the information isn't valid. Check the form and try again.";
  } else {
    out.form = SAVE_FAILED;
  }
  return out;
}

/**
 * The branding the form knows about, and nothing else: whatever other keys a row
 * carries are not sent back. (The API stores only these three anyway.)
 */
export function knownBranding(raw: OrganisationBranding | null | undefined): OrganisationBranding | null {
  if (!raw) return null;
  const out: OrganisationBranding = {};
  if (typeof raw.tilecolour === 'string') out.tilecolour = raw.tilecolour;
  if (typeof raw.logourl === 'string') out.logourl = raw.logourl;
  if (typeof raw.displayname === 'string') out.displayname = raw.displayname;
  return out;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * The colour for a tile's initials: white where it reaches 4.5:1 on the tile
 * colour (all five swatches), the page ink where it does not. The API accepts any
 * #RRGGBB, so an organisation's colour need not be one of the five.
 */
export function tileTextColour(tile: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(tile)) return '#ffffff';
  const l = luminance(tile);
  const white = 1.05 / (l + 0.05);
  return white >= 4.5 ? '#ffffff' : '#1e293b';
}
