import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { SchoolService } from 'src/app/services/school.service';
import { StandardService } from 'src/app/services/standard.service';
import { StudentService } from 'src/app/services/student.service';
import { CLASS_WORD } from '../add-learner/add-learner-form';
import { LearnerDetails } from '../edit-learner/edit-learner';
import {
  MOVE_FIELD_ORDER,
  MOVE_RESULTS_NOTE,
  MOVE_SCHOOLS_FAILED,
  MoveFieldKey,
  MoveLearnerResult,
  MoveOption,
  keptCurricula,
  moveBody,
  moveErrors,
  moveFormErrors,
  moveLoadFailure,
} from './move-learner';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The Move to another school drawer for one learner: School (the schools the list offers), Class (the chosen school's,
 * empty until a school is chosen and cleared when it changes) and Curricula (the chosen school's, with the learner's
 * current ones that it also has already chosen). It reuses the Edit details drawer's styles and wording.
 */
@Component({
  selector: 'app-move-learner-drawer',
  standalone: true,
  imports: [FormsModule, NzButtonModule, NzDrawerModule, NzSelectModule],
  templateUrl: './move-learner-drawer.component.html',
  styleUrls: ['../add-learner/add-learner-drawer.component.less', '../edit-learner/edit-learner-drawer.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoveLearnerDrawerComponent {
  private readonly students = inject(StudentService);
  private readonly schoolService = inject(SchoolService);
  private readonly standardService = inject(StandardService);

  readonly open = input(false);
  readonly schooluserid = input('');
  readonly username = input('');
  /** The schools the learner can be moved to, as the list worked them out. */
  readonly schools = input<MoveOption[]>([]);
  /** Whether the list of schools is loaded; the drawer waits for it. */
  readonly schoolsState = input<LoadState>('ready');
  /** The learner was moved: the parent says so, refreshes its list and closes the drawer. */
  readonly moved = output<MoveLearnerResult>();
  readonly closed = output<void>();
  readonly retrySchools = output<void>();

  readonly classWord = CLASS_WORD;
  readonly resultsNote = MOVE_RESULTS_NOTE;
  readonly schoolsFailed = MOVE_SCHOOLS_FAILED;

  readonly loadState = signal<LoadState>('idle');
  readonly loadMessage = signal('');
  private readonly details = signal<LearnerDetails | null>(null);

  readonly schoolId = signal<string | null>(null);
  readonly standardId = signal<string | null>(null);
  readonly curriculumIds = signal<string[]>([]);
  readonly standards = signal<MoveOption[]>([]);
  readonly curricula = signal<MoveOption[]>([]);
  readonly placementState = signal<LoadState>('idle');

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly serverErrors = signal<Partial<Record<MoveFieldKey, string>>>({});
  readonly formError = signal<string | null>(null);

  /** Bumped each time the drawer opens or closes; an answer for an earlier opening is dropped. */
  private session = 0;
  /** Bumped each time a school is chosen; an answer for a school chosen earlier is dropped. */
  private placementRead = 0;

  readonly ready = computed(() => this.loadState() === 'ready' && this.schoolsState() === 'ready');
  readonly errors = computed<Record<MoveFieldKey, string | null>>(() => {
    const client = moveFormErrors(this.schoolId(), this.standardId(), this.curriculumIds());
    const server = this.serverErrors();
    const out = {} as Record<MoveFieldKey, string | null>;
    for (const key of MOVE_FIELD_ORDER) out[key] = (this.submitted() ? client[key] : null) ?? server[key] ?? null;
    return out;
  });
  readonly canMove = computed(() => this.ready() && this.placementState() !== 'loading' && !this.submitting());

  readonly title = viewChild<ElementRef<HTMLElement>>('title');
  readonly closeButton = viewChild('closeButton', { read: ElementRef<HTMLButtonElement> });
  readonly schoolSelect = viewChild('schoolSelect', { read: ElementRef<HTMLElement> });
  readonly submitButton = viewChild('submitButton', { read: ElementRef<HTMLButtonElement> });

  constructor() {
    effect(() => {
      const open = this.open();
      const id = this.schooluserid();
      untracked(() => (open && id ? this.begin(id) : this.end()));
    });
    // While things load, focus is inside the dialog (its title); when the form appears, on School; when loading failed, on Close.
    effect(() => {
      const select = this.schoolSelect();
      if (select && this.open()) this.focusSoon(() => this.inputOf(select.nativeElement), (active) => !active?.closest('form#move-learner-form'));
    });
    effect(() => {
      const button = this.closeButton();
      if (button && this.open()) this.focusSoon(() => button.nativeElement, () => true);
    });
    effect(() => {
      const title = this.title();
      if (title && this.open() && !this.ready() && this.loadState() !== 'error') this.focusSoon(() => title.nativeElement, (active) => !active?.closest('.dialog'));
    });
  }

  private inputOf(host: HTMLElement): HTMLElement | null {
    return host.matches('input') ? host : host.querySelector<HTMLElement>('input');
  }

  /** Focuses the element after the drawer has drawn, and again if the drawer's own opening took focus back. */
  private focusSoon(find: () => HTMLElement | null, wanted: (active: HTMLElement | null) => boolean): void {
    const session = this.session;
    for (const delay of [0, 150, 400]) {
      setTimeout(() => {
        const el = find();
        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (el && session === this.session && this.open() && el.isConnected && active !== el && wanted(active)) el.focus({ preventScroll: true });
      }, delay);
    }
  }

  private begin(id: string): void {
    const session = ++this.session;
    this.placementRead++;
    this.loadState.set('loading');
    this.loadMessage.set('');
    this.details.set(null);
    this.schoolId.set(null);
    this.standardId.set(null);
    this.curriculumIds.set([]);
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
        this.details.set(((answer as any)?.data?.schooluserid ? (answer as any).data : answer) as LearnerDetails);
        this.loadState.set('ready');
      },
      error: (error: HttpErrorResponse) => {
        if (session !== this.session) return;
        this.loadMessage.set(moveLoadFailure(error));
        this.loadState.set('error');
      },
    });
  }

  /** Closing: answers still on their way are dropped. */
  private end(): void {
    this.session++;
    this.placementRead++;
    this.submitting.set(false);
  }

  /** A school was chosen: the class is emptied and the school's classes and curricula are read. */
  setSchool(schoolid: string | null): void {
    this.schoolId.set(schoolid);
    this.standardId.set(null);
    this.curriculumIds.set([]);
    this.standards.set([]);
    this.curricula.set([]);
    this.clearServer('schoolid');
    this.clearServer('standard');
    this.clearServer('curriculumids');
    const read = ++this.placementRead;
    if (!schoolid) {
      this.placementState.set('idle');
      return;
    }
    this.loadPlacement(schoolid, read);
  }

  retryPlacement(): void {
    const schoolid = this.schoolId();
    if (schoolid) this.loadPlacement(schoolid, ++this.placementRead);
  }

  private loadPlacement(schoolid: string, read: number): void {
    this.placementState.set('loading');
    let pending = 2;
    let failed = false;
    const finish = () => {
      if (read !== this.placementRead || --pending > 0) return;
      this.placementState.set(failed ? 'error' : 'ready');
      if (!failed) this.curriculumIds.set(keptCurricula(this.details()?.curriculumids ?? [], this.curricula()));
    };
    this.standardService.getSchoolidStandard(schoolid).subscribe({
      next: (answer: any) => {
        if (read !== this.placementRead) return;
        this.standards.set(((answer?.data as any[]) ?? []).map((s) => ({ label: s.standardname, value: s.standardid })));
        finish();
      },
      error: () => {
        if (read !== this.placementRead) return;
        failed = true;
        finish();
      },
    });
    this.schoolService.getCurriculums(schoolid).subscribe({
      next: (answer: any) => {
        if (read !== this.placementRead) return;
        // A deleted curriculum comes back without a name, so a missing name drops it.
        this.curricula.set(
          ((answer?.data as any[]) ?? [])
            .filter((c) => c && !c.isdeleted && typeof c.curriculumname === 'string' && c.curriculumname.trim() !== '')
            .map((c) => ({ label: c.curriculumname, value: c.curriculumid })),
        );
        finish();
      },
      error: () => {
        if (read !== this.placementRead) return;
        failed = true;
        finish();
      },
    });
  }

  private clearServer(key: MoveFieldKey): void {
    if (this.serverErrors()[key] || this.formError()) {
      this.serverErrors.update((all) => {
        const { [key]: _gone, ...rest } = all;
        return rest;
      });
      this.formError.set(null);
    }
  }
  setStandard(value: string | null): void {
    this.standardId.set(value);
    this.clearServer('standard');
  }
  setCurricula(value: string[]): void {
    this.curriculumIds.set(value ?? []);
    this.clearServer('curriculumids');
  }

  /** The drawer closed itself (the browser's Back disposes it): drop what is on its way and tell the parent. */
  onVisibleChange(visible: boolean): void {
    if (visible || !this.open()) return;
    this.end();
    this.closed.emit();
  }

  /** Cancel, Close, Escape and a click outside: nothing is sent. While a move is on its way the drawer stays. */
  requestClose(): void {
    if (this.submitting()) return;
    this.closed.emit();
  }

  submit(): void {
    if (!this.canMove()) return;
    this.submitted.set(true);
    const client = moveFormErrors(this.schoolId(), this.standardId(), this.curriculumIds());
    const first = MOVE_FIELD_ORDER.find((k) => client[k]);
    if (first) {
      this.focusField(first);
      return;
    }
    const session = this.session;
    this.submitting.set(true);
    this.formError.set(null);
    this.students.moveSchool(this.schooluserid(), moveBody(this.schoolId()!, this.standardId()!, this.curriculumIds())).subscribe({
      next: (answer) => {
        // An answer for an opening that has since been closed is not shown.
        if (session !== this.session) return;
        const result = ((answer as any)?.data?.schooluserid ? (answer as any).data : answer) as MoveLearnerResult;
        this.submitting.set(false);
        this.serverErrors.set({});
        this.moved.emit(result);
      },
      error: (error: HttpErrorResponse) => {
        if (session !== this.session) return;
        this.failed(error);
      },
    });
  }

  private failed(error: HttpErrorResponse): void {
    this.submitting.set(false);
    const { fields, form } = moveErrors(error);
    this.serverErrors.set(fields);
    this.formError.set(form ?? null);
    const first = MOVE_FIELD_ORDER.find((k) => fields[k]);
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

  private focusField(key: MoveFieldKey): void {
    const id = { schoolid: 'move-learner-school', standard: 'move-learner-class', curriculumids: 'move-learner-curricula' }[key];
    setTimeout(() => {
      const el = document.getElementById(id);
      (el?.matches('input') ? el : el?.querySelector<HTMLElement>('input'))?.focus();
    });
  }
}
