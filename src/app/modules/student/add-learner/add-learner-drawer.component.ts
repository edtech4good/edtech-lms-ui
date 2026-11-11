import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { EMPTY, Subject, timer } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { SchoolService } from 'src/app/services/school.service';
import { StandardService } from 'src/app/services/standard.service';
import { StudentService } from 'src/app/services/student.service';
import { confirmDialog } from '../../organisation/confirm-dialog';
import {
  AddLearnerBody,
  CLASS_WORD,
  CreatedLearner,
  DATE_OF_BIRTH_MIN,
  FIELD_ORDER,
  GENDER_MESSAGE,
  NO_CURRICULA_MESSAGE,
  FieldKey,
  USERNAME_AVAILABLE_MESSAGE,
  USERNAME_TAKEN_MESSAGE,
  dateOfBirthError,
  noClassesMessage,
  signInLine,
  yesterdayOf,
  firstNameError,
  lastNameError,
  NAME_MAX,
  generatePassword,
  passwordError,
  serverFieldErrors,
  usernameError,
} from './add-learner-form';

interface Option {
  label: string;
  value: string;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type Availability =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken' }
  | { kind: 'rule'; message: string };

const DEBOUNCE_MS = 350;

/**
 * The Add learner drawer: the account (names, username, password), where the learner belongs (school, class,
 * curricula) and gender and date of birth. The server decides every rule; what it refuses is shown beside the field
 * it names. After a save the drawer shows the username and the password once; closing it forgets the password.
 */
@Component({
  selector: 'app-add-learner-drawer',
  standalone: true,
  imports: [FormsModule, NzButtonModule, NzDrawerModule, NzSelectModule],
  templateUrl: './add-learner-drawer.component.html',
  styleUrl: './add-learner-drawer.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddLearnerDrawerComponent {
  private readonly students = inject(StudentService);
  private readonly schoolService = inject(SchoolService);
  private readonly standardService = inject(StandardService);
  private readonly modal = inject(NzModalService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input(false);
  /** A learner was added: the parent refreshes its list. */
  readonly added = output<CreatedLearner>();
  readonly closed = output<void>();

  readonly classWord = CLASS_WORD;
  readonly nameMax = NAME_MAX;
  readonly dobMin = DATE_OF_BIRTH_MIN;
  readonly dobMax = yesterdayOf();
  readonly noClasses = noClassesMessage();
  readonly noCurricula = NO_CURRICULA_MESSAGE;

  // ---- Form values -------------------------------------------------------------------------------------------
  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly username = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly schoolId = signal<string | null>(null);
  readonly standardId = signal<string | null>(null);
  readonly curriculumIds = signal<string[]>([]);
  readonly genderId = signal<1 | 2 | null>(null);
  readonly dateOfBirth = signal('');
  /** The date input holds something that is not a date (partly typed): it reports an empty value and `badInput`. */
  readonly dobBad = signal(false);
  /** What the form chose for the person (one school, one curriculum): not a change the person made. */
  private readonly presetSchool = signal<string | null>(null);
  private readonly presetCurricula = signal<string[]>([]);

  // ---- Lists for the selects ---------------------------------------------------------------------------------
  readonly schools = signal<Option[]>([]);
  readonly schoolsState = signal<LoadState>('idle');
  readonly standards = signal<Option[]>([]);
  readonly curricula = signal<Option[]>([]);
  readonly placementState = signal<LoadState>('idle');
  /** Which load is current: an answer for a school chosen earlier is ignored. */
  private placementRead = 0;
  private schoolsRead = 0;

  // ---- State -------------------------------------------------------------------------------------------------
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly serverErrors = signal<Partial<Record<FieldKey, string>>>({});
  readonly formError = signal<string | null>(null);
  readonly availability = signal<Availability>({ kind: 'idle' });
  /** The learner just added; the password is kept here only until the drawer is closed. */
  readonly done = signal<{ learner: CreatedLearner; password: string } | null>(null);
  readonly copied = signal<{ username: 'ok' | 'failed' | null; password: 'ok' | 'failed' | null }>({ username: null, password: null });

  private readonly usernameTyped$ = new Subject<string>();

  /** What is wrong with each field by our own rules (the server's answer is kept apart). */
  private readonly clientErrors = computed<Record<FieldKey, string | null>>(() => ({
    studentfirstname: firstNameError(this.firstName()),
    studentlastname: lastNameError(this.lastName()),
    schoolusername: usernameError(this.username().trim()),
    password: passwordError(this.password()),
    schoolid: this.schoolId() ? null : 'Choose a school.',
    standard: this.standardId() ? null : `Choose a ${this.classWord.toLowerCase()}.`,
    curriculumids: this.curriculumIds().length ? null : 'Choose at least one curriculum.',
    genderid: this.genderId() ? null : GENDER_MESSAGE,
    dateofbirth: dateOfBirthError(this.dateOfBirth(), this.dobBad()),
  }));

  /** The message to show for a field: ours once the form has been submitted, the API's always. */
  readonly errors = computed<Record<FieldKey, string | null>>(() => {
    const client = this.clientErrors();
    const server = this.serverErrors();
    const out = {} as Record<FieldKey, string | null>;
    for (const key of FIELD_ORDER) {
      out[key] = (this.submitted() ? client[key] : null) ?? server[key] ?? null;
    }
    return out;
  });

  /** The line under the username: the API's refusal of a save, else what the availability check found. */
  readonly usernameNote = computed<{ tone: 'ok' | 'error' | 'info'; text: string }>(() => {
    const refused = this.errors().schoolusername;
    if (refused) return { tone: 'error', text: refused };
    const state = this.availability();
    switch (state.kind) {
      case 'available':
        return { tone: 'ok', text: USERNAME_AVAILABLE_MESSAGE };
      case 'taken':
        return { tone: 'error', text: USERNAME_TAKEN_MESSAGE };
      case 'rule':
        return { tone: 'error', text: state.message };
      default:
        return { tone: 'info', text: '' };
    }
  });

  readonly dirty = computed(
    () =>
      this.done() === null &&
      (this.firstName().trim() !== '' ||
        this.lastName().trim() !== '' ||
        this.username() !== '' ||
        this.password() !== '' ||
        this.schoolId() !== this.presetSchool() ||
        this.standardId() !== null ||
        this.curriculumIds().join('|') !== this.presetCurricula().join('|') ||
        this.genderId() !== null ||
        this.dateOfBirth() !== '' ||
        this.dobBad()),
  );

  readonly firstNameInput = viewChild<ElementRef<HTMLInputElement>>('firstNameInput');
  readonly lastNameInput = viewChild<ElementRef<HTMLInputElement>>('lastNameInput');
  readonly usernameInput = viewChild<ElementRef<HTMLInputElement>>('usernameInput');
  readonly passwordInput = viewChild<ElementRef<HTMLInputElement>>('passwordInput');
  readonly dobInput = viewChild<ElementRef<HTMLInputElement>>('dobInput');
  readonly doneTitle = viewChild<ElementRef<HTMLElement>>('doneTitle');
  readonly submitButton = viewChild('submitButton', { read: ElementRef<HTMLButtonElement> });

  constructor() {
    // Each opening starts empty; closing forgets the password.
    effect(() => {
      if (this.open()) {
        untracked(() => this.begin());
      } else {
        untracked(() => this.forget());
      }
    });
    effect(() => {
      const first = this.firstNameInput();
      if (first && this.open() && this.done() === null) {
        for (const delay of [0, 150, 400]) {
          setTimeout(() => {
            const active = document.activeElement;
            const onField = active instanceof HTMLElement && active.closest('form#add-learner-form') !== null;
            if (this.open() && !onField) first.nativeElement.focus();
          }, delay);
        }
      }
    });

    // The availability check: every keystroke cancels the check in flight and clears what was said, so an answer for an
    // earlier value can never land on a later one. Only a value the rule accepts waits out the pause and asks.
    this.usernameTyped$
      .pipe(
        map((value) => value.trim()),
        distinctUntilChanged(),
        tap((value) => {
          const problem = value ? usernameError(value) : null;
          this.availability.set(!value ? { kind: 'idle' } : problem ? { kind: 'rule', message: problem } : { kind: 'checking' });
        }),
        switchMap((value) => {
          if (!value || usernameError(value)) return EMPTY;
          return timer(DEBOUNCE_MS).pipe(
            switchMap(() =>
              this.students.usernameAvailable(value).pipe(
                map((answer): Availability => (answer?.available === true ? { kind: 'available' } : { kind: 'taken' })),
                // A failed check says nothing and never blocks a save: the server decides.
                catchError((error: HttpErrorResponse) => {
                  const message = serverFieldErrors(error).fields.schoolusername;
                  return of<Availability>(error.status === 400 && message ? { kind: 'rule', message } : { kind: 'idle' });
                }),
              ),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => this.availability.set(state));
  }

  private begin(): void {
    this.forget();
    this.loadSchools();
  }

  /** Back to empty. The once-shown password goes with it: it lives only inside `done`, so clearing that clears it. */
  private forget(): void {
    this.placementRead++;
    this.schoolsRead++;
    this.firstName.set('');
    this.lastName.set('');
    this.username.set('');
    this.password.set('');
    this.showPassword.set(false);
    this.schoolId.set(null);
    this.standardId.set(null);
    this.curriculumIds.set([]);
    this.genderId.set(null);
    this.dateOfBirth.set('');
    this.dobBad.set(false);
    this.presetSchool.set(null);
    this.presetCurricula.set([]);
    this.standards.set([]);
    this.curricula.set([]);
    this.placementState.set('idle');
    this.submitting.set(false);
    this.submitted.set(false);
    this.serverErrors.set({});
    this.formError.set(null);
    this.availability.set({ kind: 'idle' });
    this.done.set(null);
    this.copied.set({ username: null, password: null });
    this.usernameTyped$.next('');
  }

  // ---- Lists -------------------------------------------------------------------------------------------------
  loadSchools(): void {
    const read = ++this.schoolsRead;
    this.schoolsState.set('loading');
    this.schoolService.getall({ pagesize: 200 }).subscribe({
      next: (answer: any) => {
        if (read !== this.schoolsRead) return;
        const rows: any[] = answer?.data?.data ?? [];
        this.schools.set(rows.map((s) => ({ label: s.schoolname, value: s.schoolid })));
        this.schoolsState.set('ready');
        // One school: it is the school.
        if (rows.length === 1 && !this.schoolId()) {
          this.presetSchool.set(rows[0].schoolid);
          this.setSchool(rows[0].schoolid);
        }
      },
      error: () => {
        if (read === this.schoolsRead) this.schoolsState.set('error');
      },
    });
  }

  /** A school's classes and curricula. A new choice of school empties both choices. */
  setSchool(schoolid: string | null): void {
    this.schoolId.set(schoolid);
    this.standardId.set(null);
    this.curriculumIds.set([]);
    this.standards.set([]);
    this.curricula.set([]);
    this.presetCurricula.set([]);
    this.clearServer('schoolid');
    this.clearServer('standard');
    this.clearServer('curriculumids');
    const read = ++this.placementRead;
    if (!schoolid) {
      this.placementState.set('idle');
      return;
    }
    this.placementState.set('loading');
    let pending = 2;
    let failed = false;
    const done = () => {
      if (read !== this.placementRead || --pending > 0) return;
      this.placementState.set(failed ? 'error' : 'ready');
      // One curriculum: it is the curriculum.
      if (!failed && this.curricula().length === 1 && this.curriculumIds().length === 0) {
        this.curriculumIds.set([this.curricula()[0].value]);
        this.presetCurricula.set([this.curricula()[0].value]);
      }
    };
    this.standardService.getSchoolidStandard(schoolid).subscribe({
      next: (answer: any) => {
        if (read !== this.placementRead) return;
        this.standards.set(((answer?.data as any[]) ?? []).map((s) => ({ label: s.standardname, value: s.standardid })));
        done();
      },
      error: () => {
        failed = true;
        done();
      },
    });
    this.schoolService.getPublishedCurriculums(schoolid).subscribe({
      next: (answer: any) => {
        if (read !== this.placementRead) return;
        // The route marks no deleted curriculum; a deleted one comes back without a name, so a missing name drops it.
        this.curricula.set(
          ((answer?.data as any[]) ?? [])
            .filter((c) => c && !c.isdeleted && typeof c.curriculumname === 'string' && c.curriculumname.trim() !== '')
            .map((c) => ({ label: c.curriculumname, value: c.curriculumid })),
        );
        done();
      },
      error: () => {
        failed = true;
        done();
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
  setUsername(value: string): void {
    this.username.set(value);
    this.clearServer('schoolusername');
    this.usernameTyped$.next(value);
  }
  setPassword(value: string): void {
    this.password.set(value);
    this.clearServer('password');
  }
  setStandard(value: string | null): void {
    this.standardId.set(value);
    this.clearServer('standard');
  }
  setCurricula(value: string[]): void {
    this.curriculumIds.set(value ?? []);
    this.clearServer('curriculumids');
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

  /** A new password in the field, shown so it can be read out or written down. */
  generate(): void {
    this.setPassword(generatePassword());
    this.showPassword.set(true);
  }

  // ---- Closing -----------------------------------------------------------------------------------------------
  /** The drawer closed itself (the browser's Back disposes it): forget as a normal close does, and tell the parent. */
  onVisibleChange(visible: boolean): void {
    if (visible || !this.open()) return;
    this.forget();
    this.closed.emit();
  }

  requestClose(): void {
    if (this.submitting()) return;
    if (!this.dirty()) {
      this.closed.emit();
      return;
    }
    confirmDialog(this.modal, {
      nzTitle: 'Discard this learner?',
      nzContent: "This learner hasn't been added yet.",
      nzOkText: 'Discard',
      nzOkDanger: true,
      nzCancelText: 'Keep editing',
      nzOnOk: () => this.closed.emit(),
    });
  }

  // ---- Saving ------------------------------------------------------------------------------------------------
  submit(): void {
    if (this.submitting()) return;
    this.readDobValidity();
    this.submitted.set(true);
    const errors = this.clientErrors();
    const first = FIELD_ORDER.find((k) => errors[k]);
    if (first) {
      this.focusField(first);
      return;
    }
    const last = this.lastName().trim();
    const dob = this.dateOfBirth();
    const body: AddLearnerBody = {
      schoolid: this.schoolId()!,
      standard: this.standardId()!,
      curriculumids: [...this.curriculumIds()],
      studentfirstname: this.firstName().trim(),
      ...(last ? { studentlastname: last } : {}),
      schoolusername: this.username().trim(),
      password: this.password(),
      genderid: this.genderId()!,
      ...(dob ? { dateofbirth: dob } : {}),
    };
    this.submitting.set(true);
    this.formError.set(null);
    const password = body.password;
    this.students.createOne(body).subscribe({
      next: (answer) => {
        const result = ((answer as any)?.data?.schooluserid ? (answer as any).data : answer) as CreatedLearner;
        this.submitting.set(false);
        this.done.set({ learner: result, password });
        this.serverErrors.set({});
        this.added.emit(result);
        this.focusDoneTitle();
      },
      error: (error: HttpErrorResponse) => this.failed(error),
    });
  }

  /** The panel's heading takes focus, so a screen reader announces it (and the line it is described by). */
  private focusDoneTitle(attempt = 0): void {
    const title = this.doneTitle()?.nativeElement;
    if (title) title.focus({ preventScroll: true });
    else if (attempt < 20) setTimeout(() => this.focusDoneTitle(attempt + 1), 25);
  }

  readonly signIn = computed(() => {
    const done = this.done();
    return done ? signInLine(done.learner) : null;
  });

  private failed(error: HttpErrorResponse): void {
    this.submitting.set(false);
    const { fields, form } = serverFieldErrors(error);
    this.serverErrors.set(fields);
    this.formError.set(form ?? null);
    if (fields.schoolusername) this.availability.set({ kind: 'idle' });
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
      schoolusername: this.usernameInput(),
      password: this.passwordInput(),
      dateofbirth: this.dobInput(),
    } as Partial<Record<FieldKey, ElementRef<HTMLInputElement>>>;
    const id = { schoolid: 'add-learner-school', standard: 'add-learner-class', curriculumids: 'add-learner-curricula', genderid: 'add-learner-gender-female' }[key as string];
    // After the error text has rendered; the select's own input or the first radio takes focus.
    setTimeout(() => {
      if (direct[key]) direct[key]!.nativeElement.focus();
      else if (id) {
        const el = document.getElementById(id);
        (el?.matches('input') ? el : el?.querySelector<HTMLElement>('input'))?.focus();
      }
    });
  }

  // ---- After the save ----------------------------------------------------------------------------------------
  async copy(which: 'username' | 'password', event: Event): Promise<void> {
    const button = event.currentTarget as HTMLElement | null;
    const text = which === 'username' ? this.done()?.learner.schoolusername ?? '' : this.done()?.password ?? '';
    // The Clipboard API first; some browsers refuse it, so the older route is the fallback.
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = this.copyBySelection(text, button);
    }
    this.copied.update((c) => ({ ...c, [which]: copied ? 'ok' : 'failed' }));
  }

  /**
   * Copies through a temporary read-only textarea that is selected and handed to the browser's copy command. It sits
   * inside the drawer rather than on the page body, so it stays within the dialog's focus scope and stacking; it is
   * off screen, hidden from assistive technology, and removed in every path. Focus goes back to the button that was pressed.
   */
  private copyBySelection(text: string, button: HTMLElement | null): boolean {
    const host = button?.closest('.dialog') ?? button?.parentElement;
    if (!host) return false;
    const area = document.createElement('textarea');
    area.value = text;
    area.readOnly = true;
    area.tabIndex = -1;
    area.setAttribute('aria-hidden', 'true');
    area.style.cssText = 'position:fixed;top:0;left:-9999px;width:1px;height:1px;padding:0;border:0;opacity:0;pointer-events:none';
    try {
      host.appendChild(area);
      area.focus({ preventScroll: true });
      area.select();
      area.setSelectionRange(0, text.length); // iOS ignores select() alone
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
      button?.focus({ preventScroll: true });
    }
  }
}
