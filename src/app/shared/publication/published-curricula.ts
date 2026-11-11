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

/** What a curriculum the learner already has, but that is not published, is called in the picker. */
export function heldLabel(name: string, status: PublicationStatus | string | null | undefined): string {
  return status === 'withdrawn' ? `${name} (retired)` : status === 'never' ? `${name} (not published)` : name;
}

export interface PickerOption {
  label: string;
  value: string;
}

/**
 * Splits a school's curricula (rows with `publicationstatus`) for a learner form. `offered` are the ones a new pick may be: the
 * published ones. `held` are the unpublished ones the learner already has: they stay selectable and are kept, labelled by state,
 * and a form shows one only while it is chosen (once removed it is not offered again). A row without a name is a deleted
 * curriculum and is in neither.
 */
export function splitCurricula(rows: ReadonlyArray<any>, held: readonly string[]): { offered: PickerOption[]; held: PickerOption[] } {
  const offered: PickerOption[] = [];
  const keep: PickerOption[] = [];
  for (const c of rows) {
    if (!c || c.isdeleted || typeof c.curriculumname !== 'string' || c.curriculumname.trim() === '') continue;
    if (isOffered(c.publicationstatus)) offered.push({ label: c.curriculumname, value: c.curriculumid });
    else if (held.includes(c.curriculumid)) keep.push({ label: heldLabel(c.curriculumname, c.publicationstatus), value: c.curriculumid });
  }
  return { offered, held: keep };
}
