import { LANGUAGE_CODE, normaliseLanguage } from '../../shared/translations/translations.model';

/**
 * The organisation's content language field (organisation drawer). No Angular in this file, so the Playwright logic
 * specs run it in Node (e2e/smoke/translations-logic.spec.ts).
 */

/** The languages offered for an organisation's content; anything else is typed as a code. */
export const CONTENT_LANGUAGES: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'en', name: 'English' },
  { code: 'km', name: 'Khmer' },
  { code: 'fr', name: 'French' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'id', name: 'Indonesian' },
];

/** The select's value for "another language", typed as a code. */
export const OTHER_LANGUAGE = '__other';

/** The select's value and the typed code for an organisation's stored content language. */
export function contentLanguageChoice(stored: string | null | undefined): { choice: string; other: string } {
  if (!stored) return { choice: '', other: '' };
  return CONTENT_LANGUAGES.some((l) => l.code === stored)
    ? { choice: stored, other: '' }
    : { choice: OTHER_LANGUAGE, other: stored };
}

/** What is sent: the language code as the API stores it, or null for none. */
export function contentLanguageValue(choice: string, other: string): string | null {
  if (choice === OTHER_LANGUAGE) return other.trim() === '' ? null : normaliseLanguage(other.trim());
  return choice === '' ? null : choice;
}

export function contentLanguageError(choice: string, other: string): string | null {
  if (choice !== OTHER_LANGUAGE) return null;
  const v = other.trim();
  if (!v) return 'Enter a language code, such as pt-BR.';
  if (!LANGUAGE_CODE.test(v)) return 'Use 2 to 8 letters, digits or hyphens, such as km or pt-BR.';
  return null;
}
