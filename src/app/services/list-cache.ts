/**
 * What a list page keeps in sessionStorage between visits: the lesson list and the curriculum map (rows read in one
 * organisation), and the question list's remembered search. A copy read in one organisation must never be shown in
 * another, so these are dropped whenever the acting organisation changes, on sign-in and on sign-out.
 */
export const LIST_CACHE_KEYS = [
  'lessonData',
  'tempData',
  'filter',
  'JqGJMqfgE9HEU6hC',
  'Question',
  'storeTagValue',
  'storeIdentifierValue',
  'storeStatusValue',
  'storeTypeValue',
  'pageIndex',
] as const;

export function clearListCaches(storage: Pick<Storage, 'removeItem'> | null = safeStorage()): void {
  if (!storage) return;
  for (const key of LIST_CACHE_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      /* storage blocked: nothing was kept */
    }
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}
