/**
 * Pure rules of the notices that stay, kept free of Angular so they can be checked in plain Node.
 */
import type { PushOutcome } from 'src/app/shared/publication/publication.model';

/**
 * The `push` an answer carries. Central puts it beside `data` on school create, edit and delete, class create, edit and delete,
 * and the organisation save (the last only when the quiz-pass switch was sent): `{ error, data, push }`. Absent otherwise.
 */
export function pushOf(answer: unknown): PushOutcome | undefined {
  return answer && typeof answer === 'object' ? (answer as { push?: PushOutcome }).push : undefined;
}

/**
 * Whether a refused sync's sentence sends the person to Sync Content (the learning server lacks the school or one of its classes).
 * The curriculum refusal ("Publish it, then Sync Students.") has another next step, so it gets no link.
 */
export const asksForSyncContent = (message: string): boolean => /\bSync Content\b/.test(message);
