import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorBody } from './organisation.model';

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
  if ([...value].length > SHORTNAME_MAX_CODE_POINTS || countGraphemes(value) > SHORTNAME_MAX_GRAPHEMES) {
    return `Use ${SHORTNAME_MAX_GRAPHEMES} letters or fewer.`;
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

/**
 * Turn a failed create or update into messages beside the fields. A 400 names its
 * fields. A 409 names none: the API says only which rule was broken, in its message
 * ("That organisation name ..." or "... code ..."), so the field is read from that.
 * A 409 for both a name and a code reports the name first.
 */
export function serverFieldErrors(error: HttpErrorResponse): ServerFieldErrors {
  const body = (error.error ?? {}) as ApiErrorBody;
  const out: ServerFieldErrors = { fields: {} };
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
    const message = (body.errormessage ?? '').toLowerCase();
    if (message.includes('code')) {
      out.fields.organisationcode = 'That code is already in use. Codes can never be reused.';
    } else if (message.includes('name')) {
      out.fields.organisationname = 'That name is already in use. Use a different name.';
    } else {
      out.form = 'That name or code is already in use.';
    }
    return out;
  }
  if (error.status === 404) {
    out.form = 'That organisation no longer exists.';
  } else if (error.status === 403) {
    out.form = "You don't have permission to do that.";
  } else if (error.status === 400) {
    out.form = "Some of the information isn't valid. Check the form and try again.";
  }
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
