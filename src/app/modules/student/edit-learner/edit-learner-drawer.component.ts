import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { StandardService } from 'src/app/services/standard.service';
import { SchoolService } from 'src/app/services/school.service';
import { StudentService } from 'src/app/services/student.service';
import { confirmDialog } from '../../organisation/confirm-dialog';
import { LearnerGradeFieldComponent } from '../learner-grade/learner-grade-field.component';
import { GradeState, IDLE_GRADE_STATE, gradeMessages, gradeProblem, gradeToSend, primaryCurriculumId } from '../learner-grade/learner-grade';
import {
  CLASS_WORD,
  DATE_OF_BIRTH_MIN,
  FIELD_ORDER,
  FieldKey,
  GENDER_MESSAGE,
  NAME_MAX,
  dateOfBirthError,
  firstNameError,
  lastNameError,
  yesterdayOf,
} from '../add-learner/add-learner-form';
import {
  CLASS_UNAVAILABLE_NOTE,
  CURRICULUM_UNAVAILABLE_NOTE,
  EditForm,
  EditLearnerResult,
  LearnerDetails,
  Option,
  currentPrimaryOf,
  editBody,
  editErrors,
  formFromDetails,
  isChanged,
  loadFailure,
  unavailableOf,
  withUnavailable,
} from './edit-learner';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The Edit details drawer for one learner: the username and school (read only), then names, gender, date of birth, class
 * and curricula, prefilled from the server. Save is possible only once something changed and every choice is still
 * available. It reuses the Add learner drawer's rules, wording and styles.
 */
@Component({
  selector: 'app-edit-learner-drawer',
  standalone: true,
  imports: [FormsModule, NzButtonModule, NzDrawerModule, NzSelectModule, LearnerGradeFieldComponent],
  templateUrl: './edit-learner-drawer.component.html',
  styleUrls: ['../add-learner/add-learner-drawer.component.less', './edit-learner-drawer.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditLearnerDrawerComponent {
  private readonly students = inject(StudentService);
  private readonly schoolService = inject(SchoolService);
  private readonly standardService = inject(StandardService);
  private readonly modal = inject(NzModalService);

  readonly open = input(false);
  readonly schooluserid = input('');
  /** The details were saved: the parent says so, refreshes its list and closes the drawer. */
  readonly saved = output<{ result: EditLearnerResult; fallbackName: string }>();
  readonly closed = output<void>();

  readonly classWord = CLASS_WORD;
  readonly nameMax = NAME_MAX;
  readonly dobMin = DATE_OF_BIRTH_MIN;
  readonly dobMax = yesterdayOf();
  readonly classGoneNote = CLASS_UNAVAILABLE_NOTE;
  readonly curriculumGoneNote = CURRICULUM_UNAVAILABLE_NOTE;

  // ---- What was loaded, and the form -------------------------------------------------------------------------
  readonly loadState = signal<LoadState>('idle');
  readonly loadMessage = signal('');
  readonly details = signal<LearnerDetails | null>(null);
  private readonly initial = signal<EditForm | null>(null);

  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly genderId = signal<number | null>(null);
  readonly dateOfBirth = signal('');
  /** The date input holds something that is not a date (partly typed): it reports an empty value and `badInput`. */
  readonly dobBad = signal(false);
  readonly standardId = signal<string | null>(null);
  readonly curriculumIds = signal<string[]>([]);
  /** The grade chosen among the primary curriculum's grades (the grade field clears it when it does not belong). */
  readonly gradeId = signal<string | null>(null);
  readonly gradeState = signal<GradeState>(IDLE_GRADE_STATE);

  readonly standards = signal<Option[]>([]);
  readonly curricula = signal<Option[]>([]);
  readonly placementState = signal<LoadState>('idle');

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly serverErrors = signal<Partial<Record<FieldKey, string>>>({});
  readonly formError = signal<string | null>(null);

  /** Bumped each time the drawer is opened or closed; an answer for an earlier opening carries an older number and is dropped. */
  private session = 0;

  // ---- Derived -----------------------------------------------------------------------------------------------
  private readonly current = computed<EditForm>(() => ({
    firstName: this.firstName(),
    lastName: this.lastName(),
    genderId: this.genderId(),
    dateOfBirth: this.dateOfBirth(),
    standardId: this.standardId(),
    curriculumIds: this.curriculumIds(),
  }));
  /** The learner's primary curriculum before any change; the API keeps it primary while it stays among the chosen ones. */
  readonly currentPrimary = computed(() => {
    const details = this.details();
    return details ? currentPrimaryOf(details) : null;
  });
  readonly primaryCurriculumId = computed(() => primaryCurriculumId(this.curriculumIds(), this.currentPrimary()));
  readonly primaryCurriculumName = computed(() => this.curriculumOptions().find((o) => o.value === this.primaryCurriculumId())?.label ?? '');
  /** A grade was chosen that is not the one the learner has. */
  private readonly gradeChanged = computed(() => this.gradeId() !== null && this.gradeId() !== (this.details()?.gradeid ?? null));
  readonly changed = computed(() => {
    const initial = this.initial();
    return initial !== null && (isChanged(initial, this.current()) || this.gradeChanged() || this.dobBad());
  });
  private readonly placementReady = computed(() => this.placementState() === 'ready');
  readonly classOptions = computed(() => (this.placementReady() ? withUnavailable(this.standards(), [this.standardId()]) : this.standards()));
  readonly curriculumOptions = computed(() => (this.placementReady() ? withUnavailable(this.curricula(), this.curriculumIds()) : this.curricula()));
  readonly classGone = computed(() => this.placementReady() && unavailableOf(this.standards(), [this.standardId()]).length > 0);
  readonly curriculaGone = computed(() => this.placementReady() && unavailableOf(this.curricula(), this.curriculumIds()).length > 0);
  readonly canSave = computed(
    () => this.loadState() === 'ready' && this.placementReady() && this.changed() && !this.classGone() && !this.curriculaGone() && !this.submitting(),
  );

  private readonly clientErrors = computed<Partial<Record<FieldKey, string | null>>>(() => ({
    studentfirstname: firstNameError(this.firstName()),
    studentlastname: lastNameError(this.lastName()),
    standard: this.standardId() ? null : `Choose a ${this.classWord.toLowerCase()}.`,
    curriculumids: this.curriculumIds().length ? null : 'Choose at least one curriculum.',
    gradeid: gradeProblem(this.gradeState(), this.gradeId()),
    genderid: this.genderId() ? null : GENDER_MESSAGE,
    dateofbirth: dateOfBirthError(this.dateOfBirth(), this.dobBad()),
  }));

  /** The message to show for a field: ours once Save has been pressed, the API's always. */
  readonly errors = computed<Record<FieldKey, string | null>>(() => {
    const client = this.clientErrors();
    const server = this.serverErrors();
    const out = {} as Record<FieldKey, string | null>;
    for (const key of FIELD_ORDER) out[key] = (this.submitted() ? client[key] : null) ?? server[key] ?? null;
    return out;
  });

  /** The messages about the grade: beside the Grade select, or under the curriculum field when there is no select. */
  readonly gradeMessages = computed(() =>
    gradeMessages(this.gradeState().kind, this.clientErrors().gradeid ?? null, this.serverErrors().gradeid ?? null, this.submitted()),
  );

  readonly title = viewChild<ElementRef<HTMLElement>>('title');
  readonly closeButton = viewChild('closeButton', { read: ElementRef<HTMLButtonElement> });
  readonly firstNameInput = viewChild<ElementRef<HTMLInputElement>>('firstNameInput');
  readonly lastNameInput = viewChild<ElementRef<HTMLInputElement>>('lastNameInput');
  readonly dobInput = viewChild<ElementRef<HTMLInputElement>>('dobInput');
  readonly submitButton = viewChild('submitButton', { read: ElementRef<HTMLButtonElement> });

  constructor() {
    // Each opening starts from the server's answer; closing drops whatever was still on its way.
    effect(() => {
      const open = this.open();
      const id = this.schooluserid();
      untracked(() => (open && id ? this.begin(id) : this.end()));
    });
    // While the details load, focus is inside the dialog (on its title); when the form appears, on the first name; when
    // loading failed, on Close. Each only when focus is not already where the person put it.
    effect(() => {
      const first = this.firstNameInput();
      if (first && this.open()) this.focusSoon(first.nativeElement, (active) => !active?.closest('form#edit-learner-form'));
    });
    effect(() => {
      const button = this.closeButton();
      if (button && this.open()) this.focusSoon(button.nativeElement, () => true);
    });
    effect(() => {
      const title = this.title();
      if (title && this.open() && this.loadState() === 'loading') this.focusSoon(title.nativeElement, (active) => !active?.closest('.dialog'));
    });
  }

  /** Focuses the element after the drawer has drawn, and again if the drawer's own opening took focus back. */
  private focusSoon(el: HTMLElement, wanted: (active: HTMLElement | null) => boolean): void {
    const session = this.session;
    for (const delay of [0, 150, 400]) {
      setTimeout(() => {
        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (session === this.session && this.open() && el.isConnected && active !== el && wanted(active)) el.focus({ preventScroll: true });
      }, delay);
    }
  }

  private begin(id: string): void {
    const session = ++this.session;
    this.loadState.set('loading');
    this.loadMessage.set('');
    this.details.set(null);
    this.initial.set(null);
    this.firstName.set('');
    this.lastName.set('');
    this.genderId.set(null);
    this.dateOfBirth.set('');
    this.dobBad.set(false);
    this.standardId.set(null);
    this.curriculumIds.set([]);
    this.gradeId.set(null);
    this.gradeState.set(IDLE_GRADE_STATE);
    this.standards.set([]);
    this.curricula.set([]);
    this.placementState.set('idle');
    this.submitting.set(false);
    this.submitted.set(false);
    this.serverErrors.set({});
    this.formError.set(null);
    this.students.getDetails(id).subscribe({
      next: (answer) => {
        if (session !== this.session) return;
        const details = ((answer as any)?.data?.schooluserid ? (answer as any).data : answer) as LearnerDetails;
        const form = formFromDetails(details);
        this.details.set(details);
        this.initial.set(form);
        this.firstName.set(form.firstName);
        this.lastName.set(form.lastName);
        this.genderId.set(form.genderId);
        this.dateOfBirth.set(form.dateOfBirth);
        this.standardId.set(form.standardId);
        this.curriculumIds.set(form.curriculumIds);
        this.loadState.set('ready');
        this.loadPlacement();
      },
      error: (error: HttpErrorResponse) => {
        if (session !== this.session) return;
        this.loadMessage.set(loadFailure(error));
        this.loadState.set('error');
      },
    });
  }

  /** Closing (or an opening with nothing to open): answers still on their way are dropped. */
  private end(): void {
    this.session++;
    this.submitting.set(false);
  }

  /** The learner's school's classes and curricula. */
  loadPlacement(): void {
    const schoolid = this.details()?.schoolid;
    if (!schoolid) return;
    const session = this.session;
    this.placementState.set('loading');
    let pending = 2;
    let failed = false;
    const finish = () => {
      if (session !== this.session || --pending > 0) return;
      this.placementState.set(failed ? 'error' : 'ready');
    };
    this.standardService.getSchoolidStandard(schoolid).subscribe({
      next: (answer: any) => {
        if (session !== this.session) return;
        this.standards.set(((answer?.data as any[]) ?? []).map((s) => ({ label: s.standardname, value: s.standardid })));
        finish();
      },
      error: () => {
        failed = true;
        finish();
      },
    });
    this.schoolService.getCurriculums(schoolid).subscribe({
      next: (answer: any) => {
        if (session !== this.session) return;
        // The route marks no deleted curriculum; a deleted one comes back without a name, so a missing name drops it.
        this.curricula.set(
          ((answer?.data as any[]) ?? [])
            .filter((c) => c && !c.isdeleted && typeof c.curriculumname === 'string' && c.curriculumname.trim() !== '')
            .map((c) => ({ label: c.curriculumname, value: c.curriculumid })),
        );
        finish();
      },
      error: () => {
        failed = true;
        finish();
      },
    });
  }

  // ---- Field handlers ----------------------------------------------------------------------------------------
  private clearServer(key: FieldKey): void {
    if (this.serverErrors()[key] || this.formError()) {
      this.serverErrors.update((all) => {
        const { [key]: _gone, ...rest } = all;
        return rest;
      });
      this.formError.set(null);
    }
  }
  setFirstName(value: string): void {
    this.firstName.set(value);
    this.clearServer('studentfirstname');
  }
  setLastName(value: string): void {
    this.lastName.set(value);
    this.clearServer('studentlastname');
  }
  setGender(value: 1 | 2): void {
    this.genderId.set(value);
    this.clearServer('genderid');
  }
  setDateOfBirth(value: string): void {
    this.dateOfBirth.set(value);
    this.readDobValidity();
    this.clearServer('dateofbirth');
  }
  /** A partly typed date reads as empty to the form; the input itself knows it is not. */
  readDobValidity(): void {
    this.dobBad.set(this.dobInput()?.nativeElement.validity.badInput === true);
  }
  setStandard(value: string | null): void {
    this.standardId.set(value);
    this.clearServer('standard');
  }
  setCurricula(value: string[]): void {
    this.curriculumIds.set(value ?? []);
    this.clearServer('curriculumids');
    this.clearServer('gradeid');
  }
  /** A grade was chosen (or cleared with the curriculum it belonged to). */
  onGradeChosen(): void {
    this.clearServer('gradeid');
  }

  // ---- Closing -----------------------------------------------------------------------------------------------
  /** The drawer closed itself (the browser's Back disposes it): drop what is on its way and tell the parent. */
  onVisibleChange(visible: boolean): void {
    if (visible || !this.open()) return;
    this.end();
    this.closed.emit();
  }

  requestClose(): void {
    if (this.submitting()) return;
    if (!this.changed()) {
      this.closed.emit();
      return;
    }
    confirmDialog(this.modal, {
      nzTitle: 'Discard your changes?',
      nzContent: "The changes to this learner's details haven't been saved.",
      nzOkText: 'Discard',
      nzOkDanger: true,
      nzCancelText: 'Keep editing',
      nzOnOk: () => this.closed.emit(),
    });
  }

  // ---- Saving ------------------------------------------------------------------------------------------------
  submit(): void {
    if (!this.canSave()) return;
    this.readDobValidity();
    this.submitted.set(true);
    const errors = this.clientErrors();
    const first = FIELD_ORDER.find((k) => errors[k]);
    if (first) {
      this.focusField(first);
      return;
    }
    const id = this.schooluserid();
    const form = this.current();
    const session = this.session;
    this.submitting.set(true);
    this.formError.set(null);
    this.students.updateDetails(id, editBody(form, gradeToSend(this.gradeState(), this.gradeId()))).subscribe({
      next: (answer) => {
        // An answer for an opening that has since been closed is not shown.
        if (session !== this.session) return;
        const result = ((answer as any)?.data?.schooluserid ? (answer as any).data : answer) as EditLearnerResult;
        this.submitting.set(false);
        this.serverErrors.set({});
        this.saved.emit({ result, fallbackName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim() });
      },
      error: (error: HttpErrorResponse) => {
        if (session !== this.session) return;
        this.failed(error);
      },
    });
  }

  private failed(error: HttpErrorResponse): void {
    this.submitting.set(false);
    const { fields, form } = editErrors(error);
    this.serverErrors.set(fields);
    this.formError.set(form ?? null);
    const first = FIELD_ORDER.find((k) => fields[k]);
    if (first) this.focusField(first);
    else this.focusSubmitWhenEnabled();
  }

  private focusSubmitWhenEnabled(attempt = 0): void {
    const button = this.submitButton()?.nativeElement;
    if (button && !button.disabled) {
      button.focus({ preventScroll: true });
      button.closest('.dialog')?.querySelector('.form-error')?.scrollIntoView({ block: 'nearest' });
    } else if (attempt < 20) {
      setTimeout(() => this.focusSubmitWhenEnabled(attempt + 1), 25);
    }
  }

  private focusField(key: FieldKey): void {
    const direct = {
      studentfirstname: this.firstNameInput(),
      studentlastname: this.lastNameInput(),
      dateofbirth: this.dobInput(),
    } as Partial<Record<FieldKey, ElementRef<HTMLInputElement>>>;
    // The Grade select is on the form only while the curriculum has several grades; otherwise its message is under Curriculum.
    const id = {
      standard: 'edit-learner-class',
      curriculumids: 'edit-learner-curricula',
      gradeid: document.getElementById('edit-learner-grade') ? 'edit-learner-grade' : 'edit-learner-curricula',
      genderid: 'edit-learner-gender-female',
    }[key as string];
    // After the error text has rendered; the select's own input or the first radio takes focus.
    setTimeout(() => {
      if (direct[key]) direct[key]!.nativeElement.focus();
      else if (id) {
        const el = document.getElementById(id);
        (el?.matches('input') ? el : el?.querySelector<HTMLElement>('input'))?.focus();
      }
    });
  }
}
