/** What a refused class delete says; the class list shows it itself, because the delete request opts out of the generic toast. */

export const DELETE_FAILED_FALLBACK = "That class couldn't be deleted. Try again in a moment.";

const word = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * The API's own sentence for a 400 on a class delete. It is on the field the refusal names (`fields[0].message`);
 * the top-level `errormessage` is the generic "Some of the information isn't valid." line, used only when no field
 * carries a sentence.
 */
export function classDeleteRefusalText(body: unknown): string {
  const b = (typeof body === 'object' && body !== null ? body : {}) as { errormessage?: unknown; fields?: unknown };
  const fields = Array.isArray(b.fields) ? b.fields : [];
  for (const f of fields) {
    const said = word((typeof f === 'object' && f !== null ? (f as { message?: unknown }) : {}).message);
    if (said) return said;
  }
  return word(b.errormessage) || DELETE_FAILED_FALLBACK;
}
