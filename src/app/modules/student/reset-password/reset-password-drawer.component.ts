import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { StudentService } from 'src/app/services/student.service';
import { TeacherService } from 'src/app/services/teacher.service';
import { AccountKind } from '../account-disable';
import { generatePassword, passwordError } from '../add-learner/add-learner-form';
import { copyText } from './copy-text';
import { DISABLED_NOTE, ResetResult, WRITE_IT_DOWN, resetBody, resetDoneLine, resetErrors } from './reset-password';

/**
 * The Reset password drawer, for one learner or one teacher: the username (read only), a new password with Generate
 * and Show, and Save. After a save it shows the username and the new password once; closing the drawer forgets the
 * password. It reuses the Add learner drawer's password rule, generator and styles.
 */
@Component({
  selector: 'app-reset-password-drawer',
  standalone: true,
  imports: [FormsModule, NzButtonModule, NzDrawerModule],
  templateUrl: './reset-password-drawer.component.html',
  styleUrl: '../add-learner/add-learner-drawer.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordDrawerComponent {
  private readonly students = inject(StudentService);
  private readonly teachers = inject(TeacherService);

  readonly open = input(false);
  readonly kind = input<AccountKind>('learner');
  readonly schooluserid = input('');
  readonly username = input('');
  /** The account is disabled: the password can still be reset, and the account stays disabled. */
  readonly accountDisabled = input(false);
  readonly closed = output<void>();

  readonly disabledNote = DISABLED_NOTE;
  readonly writeItDown = WRITE_IT_DOWN;

  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  /** The new password, kept here only until the drawer is closed. */
  readonly done = signal<{ username: string; password: string; result: ResetResult | null } | null>(null);
  readonly copied = signal<{ username: 'ok' | 'failed' | null; password: 'ok' | 'failed' | null }>({ username: null, password: null });

  readonly passwordMessage = computed(() => (this.submitted() ? passwordError(this.password()) : null) ?? this.serverError());
  readonly doneLine = computed(() => {
    const done = this.done();
    return done ? resetDoneLine(this.kind(), done.username, done.result?.push) : null;
  });

  readonly passwordInput = viewChild<ElementRef<HTMLInputElement>>('passwordInput');
  readonly doneTitle = viewChild<ElementRef<HTMLElement>>('doneTitle');
  readonly submitButton = viewChild('submitButton', { read: ElementRef<HTMLButtonElement> });

  constructor() {
    // Each opening starts empty; closing forgets the password.
    effect(() => {
      this.open();
      untracked(() => this.forget());
    });
    effect(() => {
      const first = this.passwordInput();
      if (first && this.open() && this.done() === null) {
        for (const delay of [0, 150, 400]) {
          setTimeout(() => {
            const active = document.activeElement;
            const onField = active instanceof HTMLElement && active.closest('form#reset-password-form') !== null;
            if (this.open() && !onField) first.nativeElement.focus();
          }, delay);
        }
      }
    });
  }

  private forget(): void {
    this.password.set('');
    this.showPassword.set(false);
    this.submitting.set(false);
    this.submitted.set(false);
    this.serverError.set(null);
    this.formError.set(null);
    this.done.set(null);
    this.copied.set({ username: null, password: null });
  }

  setPassword(value: string): void {
    this.password.set(value);
    this.serverError.set(null);
    this.formError.set(null);
  }

  /** A new password in the field, shown so it can be read out or written down. */
  generate(): void {
    this.setPassword(generatePassword());
    this.showPassword.set(true);
  }

  /** The drawer closed itself (the browser's Back disposes it): forget as a normal close does, and tell the parent. */
  onVisibleChange(visible: boolean): void {
    if (visible || !this.open()) return;
    this.forget();
    this.closed.emit();
  }

  requestClose(): void {
    if (this.submitting()) return;
    this.closed.emit();
  }

  submit(): void {
    if (this.submitting()) return;
    this.submitted.set(true);
    if (passwordError(this.password())) {
      this.focusPassword();
      return;
    }
    const password = this.password();
    const username = this.username();
    const id = this.schooluserid();
    this.submitting.set(true);
    this.formError.set(null);
    const request = this.kind() === 'teacher' ? this.teachers.resetPassword(id, resetBody(password)) : this.students.resetPassword(id, resetBody(password));
    request.subscribe({
      next: (answer) => {
        this.submitting.set(false);
        this.serverError.set(null);
        this.done.set({ username, password, result: answer ?? null });
        this.focusDoneTitle();
      },
      error: (error: HttpErrorResponse) => this.failed(error),
    });
  }

  private failed(error: HttpErrorResponse): void {
    this.submitting.set(false);
    const { password, form } = resetErrors(error);
    this.serverError.set(password ?? null);
    this.formError.set(form ?? null);
    if (password) this.focusPassword();
    else this.focusSubmitWhenEnabled();
  }

  /**
   * The panel's heading takes focus, so a screen reader announces it (and the line it is described by). The Save button
   * that held focus leaves the page when the panel is drawn, and the browser then drops focus to the body; so focus is
   * set after the panel is drawn, and set again if it was lost.
   */
  private focusDoneTitle(attempt = 0): void {
    setTimeout(() => {
      const title = this.doneTitle()?.nativeElement;
      if (title && document.activeElement !== title) title.focus({ preventScroll: true });
      if ((!title || document.activeElement !== title) && attempt < 20) this.focusDoneTitle(attempt + 1);
    }, attempt === 0 ? 0 : 25);
  }

  private focusPassword(): void {
    setTimeout(() => this.passwordInput()?.nativeElement.focus());
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

  async copy(which: 'username' | 'password', event: Event): Promise<void> {
    const text = which === 'username' ? this.done()?.username ?? '' : this.done()?.password ?? '';
    const ok = await copyText(text, event.currentTarget as HTMLElement | null);
    this.copied.update((c) => ({ ...c, [which]: ok ? 'ok' : 'failed' }));
  }
}
