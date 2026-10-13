/**
 * Media library, phase 0, as the admin uses it (docs/media-library-phase0-design.md, sections 5 to 7 and 10).
 *
 * NO ANGULAR IMPORTS HERE: this file is plain TypeScript so the Playwright suite (plain Node) can test it.
 *
 * THE LICENCE LIST IS COPIED FROM THE API: central's `src/constants/media-library.ts` (`DOCUMENT_LICENCES`) is the
 * one list; the student API holds the same file and refuses an id it does not know. The API refuses an id that is not
 * on its list, so a list that drifts here only shows in the select. Change all three together.
 */

/** The licence a document has until someone records another. */
export const DEFAULT_DOCUMENT_LICENCE = 'unspecified';

/** The type the learning picker is limited to (`FileType.VIDEO`). */
export const VIDEO_DOCUMENT_TYPE_ID = 2;

const CC_FAMILY = ['CC-BY', 'CC-BY-SA', 'CC-BY-NC', 'CC-BY-NC-SA', 'CC-BY-ND', 'CC-BY-NC-ND'] as const;
const CC_VERSIONS = ['4.0', '3.0', '2.0'] as const;

/** The 21 ids, in the order of central's list. */
export const DOCUMENT_LICENCES: readonly string[] = [
  'CC0-1.0',
  ...CC_FAMILY.flatMap((family) => CC_VERSIONS.map((version) => `${family}-${version}`)),
  'LicenseRef-all-rights-reserved',
  DEFAULT_DOCUMENT_LICENCE,
];

/** What the select shows for an id. The id is what is sent and stored. */
export function licenceLabel(id: string): string {
  if (id === DEFAULT_DOCUMENT_LICENCE) return 'Not recorded';
  if (id === 'LicenseRef-all-rights-reserved') return 'All rights reserved';
  if (id === 'CC0-1.0') return 'CC0 1.0 (public domain)';
  // CC-BY-NC-SA-4.0 -> "CC BY-NC-SA 4.0"
  const match = /^CC-(.+)-(\d\.\d)$/.exec(id);
  return match ? `CC ${match[1]} ${match[2]}` : id;
}

export interface LicenceOption {
  value: string;
  label: string;
}

export const LICENCE_OPTIONS: readonly LicenceOption[] = DOCUMENT_LICENCES.map((value) => ({ value, label: licenceLabel(value) }));

/** The three attribution texts, as typed in the form. All optional. */
export interface AttributionFields {
  author: string;
  sourceurl: string;
  adaptedfrom: string;
}

/** What the upload and edit forms hold. */
export interface DocumentMetadataModel extends AttributionFields {
  title: string;
  /** null when the select was cleared: it is sent as the default. */
  licence: string | null;
}

export function emptyMetadata(): DocumentMetadataModel {
  return { title: '', licence: DEFAULT_DOCUMENT_LICENCE, author: '', sourceurl: '', adaptedfrom: '' };
}

/**
 * The title a file gets in the form: its name without the last extension. Nothing else is changed (no case, no
 * Unicode normalisation: a Khmer name keeps its marks exactly).
 */
export function titleFromFileName(fileName: string): string {
  const base = (fileName ?? '').split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

/**
 * The title field after a file is chosen: the file's name without its extension, unless the person has typed their
 * own title (anything other than empty or the title this function filled in last time).
 */
export function nextTitle(current: string, lastPrefill: string, fileName: string): string {
  return current.length === 0 || current === lastPrefill ? titleFromFileName(fileName) : current;
}

/**
 * The attribution as the API stores it: `{ v: 1, author?, sourceurl?, adaptedfrom? }`, empty keys left out, or null
 * when nothing was typed. (The API trims too, and decides what is valid; this does not repeat its rules.)
 */
export function buildAttribution(fields: Partial<AttributionFields>): { v: 1; author?: string; sourceurl?: string; adaptedfrom?: string } | null {
  const out: { v: 1; author?: string; sourceurl?: string; adaptedfrom?: string } = { v: 1 };
  for (const key of ['author', 'sourceurl', 'adaptedfrom'] as const) {
    const text = (fields[key] ?? '').trim();
    if (text.length > 0) out[key] = text;
  }
  return Object.keys(out).length > 1 ? out : null;
}

/** The form fields for a stored attribution (a row of the list). Anything unreadable is empty. */
export function attributionFields(stored: unknown): AttributionFields {
  const o = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  const text = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '');
  return { author: text('author'), sourceurl: text('sourceurl'), adaptedfrom: text('adaptedfrom') };
}

/** The licence to send: the select's value, or the default when it was cleared. */
export function licenceToSend(licence: string | null | undefined): string {
  const value = (licence ?? '').trim();
  return value.length > 0 ? value : DEFAULT_DOCUMENT_LICENCE;
}

/**
 * The optional multipart fields of `POST /document/upload`. A blank title is left out (the API then uses the file's
 * name without its extension); the licence is always sent; the attribution is JSON text and left out when empty.
 */
export function uploadFields(meta: DocumentMetadataModel): Record<string, string> {
  const fields: Record<string, string> = {};
  const title = meta.title.trim();
  if (title.length > 0) fields['documenttitle'] = title;
  fields['documentlicence'] = licenceToSend(meta.licence);
  const attribution = buildAttribution(meta);
  if (attribution) fields['documentattribution'] = JSON.stringify(attribution);
  return fields;
}

/**
 * The fields sent with each file when several are uploaded together (one request per file: the API takes one file per
 * request). One title cannot name several files, so with more than one file none is sent and each file's name is its title.
 */
export function uploadFieldsFor(meta: DocumentMetadataModel, fileCount: number): Record<string, string> {
  return uploadFields(fileCount > 1 ? { ...meta, title: '' } : meta);
}

/** What the modal says after an upload in which some files were refused: the message alone for one file, else one line per file. */
export function failureText(failures: Array<{ name: string; message: string }>, fileCount: number): string {
  if (fileCount <= 1) return failures.map((f) => f.message).join(' ');
  return failures.map((f) => `${f.name}: ${f.message}`).join('\n');
}

/** The body of `PUT /document/:documentid`: null clears the title (the name shows) and the attribution. */
export function updateBody(meta: DocumentMetadataModel): { documenttitle: string | null; documentlicence: string; documentattribution: ReturnType<typeof buildAttribution> } {
  const title = meta.title.trim();
  return {
    documenttitle: title.length > 0 ? title : null,
    documentlicence: licenceToSend(meta.licence),
    documentattribution: buildAttribution(meta),
  };
}

/** What a document is called wherever it is listed or picked: its title, else its name (the storage key). */
export function documentLabel(doc: { documenttitle?: string | null; documentname?: string | null } | null | undefined): string {
  const title = doc?.documenttitle;
  if (typeof title === 'string' && title.trim().length > 0) return title;
  return doc?.documentname ?? '';
}

/** The refusal an upload came back with, as one line: the API's field messages if it gave any, else its message. */
export function refusalMessage(error: { status?: number; error?: { errormessage?: unknown; fields?: unknown } } | null | undefined): string {
  const body = error?.error;
  const fields = Array.isArray(body?.fields) ? (body?.fields as Array<{ message?: unknown }>) : [];
  const said = fields.map((f) => (typeof f?.message === 'string' ? f.message : '')).filter((m) => m.length > 0);
  if (said.length > 0) return said.join(' ');
  if (typeof body?.errormessage === 'string' && body.errormessage.trim().length > 0) return body.errormessage;
  if (error?.status === 403) return "You don't have permission to do that.";
  return 'That did not go through.';
}

/**
 * The document type filter: the id of the type a person typed (a name of the enum, any case), as the text the list
 * request sends. The API matches the id exactly, so a typed type is one id and never a prefix of another.
 */
export function documentTypeFilterValue(typed: string, types: Record<string, string | number>): string | null {
  const wanted = (typed ?? '').trim().toUpperCase();
  if (wanted.length === 0) return null;
  const hit = Object.entries(types).find(([name, id]) => name === wanted && typeof id === 'number');
  return hit ? String(hit[1]) : null;
}
