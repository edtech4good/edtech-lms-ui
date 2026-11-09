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
import { EMPTY, Subject, of, timer } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { SchoolService } from 'src/app/services/school.service';
import { StudentService } from 'src/app/services/student.service';
import { TeacherService } from 'src/app/services/teacher.service';
import { confirmDialog } from '../../organisation/confirm-dialog';
import {
  USERNAME_TAKEN_MESSAGE,
  generatePassword,
  passwordError,
  usernameError,
} from '../../student/add-learner/add-learner-form';
import {
  AddTeacherBody,
  CreatedTeacher,
  TEACHER_FIELD_ORDER,
  TEACHER_USERNAME_AVAILABLE_MESSAGE,
  TeacherFieldKey,
  teacherServerErrors,
  teacherSignInLine,
} from './add-teacher-form';

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
 * The Add teacher drawer: a username, a password and the school. A teacher account stores nothing else. The server
 * decides every rule; what it refuses is shown beside the field it names. After a save the drawer shows the username
 * and the password once; closing it forgets the password. It is the Add learner drawer's twin, built on the same rules
 * and the same styles (the learner drawer is shaped by classes, curricula and a profile that a teacher does not have).
 */
@Component({
  selector: 'app-add-teacher-drawer',
  standalone: true,
  imports: [FormsModule, NzButtonModule, NzDrawerModule, NzSelectModule],
  templateUrl: './add-teacher-drawer.component.html',
  styleUrl: '../../student/add-learner/add-learner-drawer.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTeacherDrawerComponent {
  private readonly teachers = inject(TeacherService);
  /** The username check covers learners and teachers alike: one route, `student/username-available`. */
  private readonly students = inject(StudentService);
  private readonly schoolService = inject(SchoolService);
  private readonly modal = inject(NzModalService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input(false);
  /** A teacher was added: the parent refreshes its list. */
  readonly added = output<CreatedTeacher>();
  readonly closed = output<void>();

  // ---- Form values -------------------------------------------------------------------------------------------
  readonly username = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly schoolId = signal<string | null>(null);
  /** What the form chose for the person (the only school): not a change the person made. */
  private readonly presetSchool = signal<string | null>(null);

  readonly schools = signal<Option[]>([]);
  readonly schoolsState = signal<LoadState>('idle');
  private schoolsRead = 0;

  // ---- State -------------------------------------------------------------------------------------------------
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly serverErrors = signal<Partial<Record<TeacherFieldKey, string>>>({});
  readonly formError = signal<string | null>(null);
  readonly availability = signal<Availability>({ kind: 'idle' });
  /** The teacher just added; the password is kept here only until the drawer is closed. */
  readonly done = signal<{ teacher: CreatedTeacher; password: string } | null>(null);
  readonly copied = signal<{ username: 'ok' | 'failed' | null; password: 'ok' | 'failed' | null }>({ username: null, password: null });

  private readonly usernameTyped$ = new Subject<string>();

  private readonly clientErrors = computed<Record<TeacherFieldKey, string | null>>(() => ({
    schoolusername: usernameError(this.username().trim()),
    password: passwordError(this.password()),
    schoolid: this.schoolId() ? null : 'Choose a school.',
  }));

  /** The message to show for a field: ours once the form has been submitted, the API's always. */
  readonly errors = computed<Record<TeacherFieldKey, string | null>>(() => {
    const client = this.clientErrors();
    const server = this.serverErrors();
    const out = {} as Record<TeacherFieldKey, string | null>;
    for (const key of TEACHER_FIELD_ORDER) {
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
        return { tone: 'ok', text: TEACHER_USERNAME_AVAILABLE_MESSAGE };
      case 'taken':
        return { tone: 'error', text: USERNAME_TAKEN_MESSAGE };
      case 'rule':
        return { tone: 'error', text: state.message };
      default:
        return { tone: 'info', text: '' };
    }
  });

  readonly dirty = computed(
    () => this.done() === null && (this.username() !== '' || this.password() !== '' || this.schoolId() !== this.presetSchool()),
  );

  readonly usernameInput = viewChild<ElementRef<HTMLInputElement>>('usernameInput');
  readonly passwordInput = viewChild<ElementRef<HTMLInputElement>>('passwordInput');
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
      const first = this.usernameInput();
      if (first && this.open() && this.done() === null) {
        for (const delay of [0, 150, 400]) {
          setTimeout(() => {
            const active = document.activeElement;
            const onField = active instanceof HTMLElement && active.closest('form#add-teacher-form') !== null;
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
                  const message = teacherServerErrors(error).fields.schoolusername;
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
    this.schoolsRead++;
    this.username.set('');
    this.password.set('');
    this.showPassword.set(false);
    this.schoolId.set(null);
    this.presetSchool.set(null);
    this.submitting.set(false);
    this.submitted.set(false);
    this.serverErrors.set({});
    this.formError.set(null);
    this.availability.set({ kind: 'idle' });
    this.done.set(null);
    this.copied.set({ username: null, password: null });
    this.usernameTyped$.next('');
  }

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

  // ---- Field handlers ----------------------------------------------------------------------------------------
  private clearServer(key: TeacherFieldKey): void {
    if (this.serverErrors()[key] || this.formError()) {
      this.serverErrors.update((all) => {
        const { [key]: _gone, ...rest } = all;
        return rest;
      });
      this.formError.set(null);
    }
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
  setSchool(schoolid: string | null): void {
    this.schoolId.set(schoolid);
    this.clearServer('schoolid');
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
      nzTitle: 'Discard this teacher?',
      nzContent: "This teacher hasn't been added yet.",
      nzOkText: 'Discard',
      nzOkDanger: true,
      nzCancelText: 'Keep editing',
      nzOnOk: () => this.closed.emit(),
    });
  }

  // ---- Saving ------------------------------------------------------------------------------------------------
  submit(): void {
    if (this.submitting()) return;
    this.submitted.set(true);
    const errors = this.clientErrors();
    const first = TEACHER_FIELD_ORDER.find((k) => errors[k]);
    if (first) {
      this.focusField(first);
      return;
    }
    const body: AddTeacherBody = {
      schoolid: this.schoolId()!,
      schoolusername: this.username().trim(),
      password: this.password(),
    };
    this.submitting.set(true);
    this.formError.set(null);
    const password = body.password;
    this.teachers.createOne(body).subscribe({
      next: (answer) => {
        const result = ((answer as any)?.data?.schooluserid ? (answer as any).data : answer) as CreatedTeacher;
        this.submitting.set(false);
        this.done.set({ teacher: result, password });
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
    return done ? teacherSignInLine(done.teacher) : null;
  });

  private failed(error: HttpErrorResponse): void {
    this.submitting.set(false);
    const { fields, form } = teacherServerErrors(error);
    this.serverErrors.set(fields);
    this.formError.set(form ?? null);
    if (fields.schoolusername) this.availability.set({ kind: 'idle' });
    const first = TEACHER_FIELD_ORDER.find((k) => fields[k]);
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

  private focusField(key: TeacherFieldKey): void {
    // After the error text has rendered; the select's own input takes focus.
    setTimeout(() => {
      if (key === 'schoolusername') this.usernameInput()?.nativeElement.focus();
      else if (key === 'password') this.passwordInput()?.nativeElement.focus();
      else document.getElementById('add-teacher-school')?.querySelector<HTMLElement>('input')?.focus();
    });
  }

  // ---- After the save ----------------------------------------------------------------------------------------
  async copy(which: 'username' | 'password', event: Event): Promise<void> {
    const button = event.currentTarget as HTMLElement | null;
    const text = which === 'username' ? this.done()?.teacher.schoolusername ?? '' : this.done()?.password ?? '';
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
   * inside the drawer, off screen and hidden from assistive technology, and is removed in every path. Focus goes back
   * to the button that was pressed.
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
