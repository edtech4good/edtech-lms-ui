/**
 * Which curricula the learner forms offer. A learner can only be placed in a curriculum that has been published (central
 * refuses another one: "Publish <curriculum> first, or choose another curriculum."), so the pickers leave out one that was
 * never published or was retired. The state is read from `GET curriculum/publication/:id` (`publicationstatus`), the same
 * answer the Curriculum list's pill shows. Pure rules, no Angular; tested in Node.
 */
import type { PublicationStatus } from './publication.model';

/**
 * Whether a curriculum is offered. Only a state the API said is not published (`never`, or `withdrawn`, which the screen calls
 * retired) hides it. A state that could not be read (the person cannot view curricula, the call failed, an answer with no
 * state) leaves it offered: central still refuses an unpublished one, so the picker never blocks an enrolment on a read.
 */
export function isOffered(status: PublicationStatus | string | null | undefined): boolean {
  return status !== 'never' && status !== 'withdrawn';
}
