import { expect, test } from '@playwright/test';
import { DELETE_FAILED_FALLBACK, classDeleteRefusalText } from '../../src/app/modules/standard/standard-index/standard-delete-refusal';

/**
 * The words the class list shows for a refused class delete (standard-delete-refusal.ts), in Node. The API puts the sentence
 * on the field the refusal names; its top-level message is the generic line the error interceptor would have toasted.
 * The class list in a browser, against the real answer, is in standard-delete.spec.ts.
 */
const SENTENCE = "That class has 3 learners and can't be deleted. Move or remove them first.";
const GENERIC = "Some of the information isn't valid.";

test.describe('the sentence of a refused class delete', () => {
  test('is the field message, not the generic top-level line', () => {
    const body = { error: true, code: 'INVALID_INPUT', errormessage: GENERIC, fields: [{ field: 'standardid', message: SENTENCE }], hint: 'Check the highlighted fields.' };
    expect(classDeleteRefusalText(body)).toBe(SENTENCE);
  });

  test('is the first field that has words', () => {
    const body = { errormessage: GENERIC, fields: [{ field: 'a', message: '  ' }, { field: 'standardid', message: SENTENCE }, { field: 'b', message: 'Other.' }] };
    expect(classDeleteRefusalText(body)).toBe(SENTENCE);
  });

  test('falls back to the top-level message when no field has words', () => {
    expect(classDeleteRefusalText({ errormessage: 'Nope.', fields: [] })).toBe('Nope.');
    expect(classDeleteRefusalText({ errormessage: 'Nope.' })).toBe('Nope.');
  });

  test('falls back to a plain line for a body with nothing readable', () => {
    for (const body of [null, undefined, 'text', 7, {}, { fields: 'x' }, { fields: [null, 3] }, { errormessage: 5 }]) {
      expect(classDeleteRefusalText(body)).toBe(DELETE_FAILED_FALLBACK);
    }
  });
});
