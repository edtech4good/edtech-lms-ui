import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { GradeService } from 'src/app/services/grade.service';
import { GradeLoad, GradeOption, GradeState, GRADE_LOAD_FAILED_MESSAGE, gradeHint, gradeKind, gradeLine, gradeOptionsOf, reconcileGrade } from './learner-grade';
import { SelectInputAttrsDirective } from './select-input-attrs.directive';

/**
 * The Grade of a learner on the Add, Edit and Move drawers and the Upload Users modal. It reads the grades of the primary
 * curriculum it is given and tells its form what it found (`state`). One grade: shown as text, nothing to choose. Several:
 * a select, labelled with the curriculum it belongs to. None: nothing here; the form says so under the curriculum field.
 * When the curriculum changes the grades are read again and a grade that no longer belongs is cleared.
 */
@Component({
  selector: 'app-learner-grade-field',
  standalone: true,
  imports: [FormsModule, NzSelectModule, SelectInputAttrsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../add-learner/add-learner-drawer.component.less',
  template: `
    @switch (kind()) {
      @case ('one') {
        <p class="help" data-testid="grade-fixed" [id]="idPrefix() + '-fixed'">
          {{ line() }}
          @if (hint()) {
            <span> ({{ hint() }})</span>
          }
        </p>
      }
      @case ('several') {
        <div class="field" data-testid="grade-field">
          <label class="label" [attr.for]="idPrefix() + '-input'">
            Grade
            @if (!optional()) {
              <span class="req" aria-hidden="true">*</span>
            }
          </label>
          <nz-select
            [id]="idPrefix()"
            [nzId]="idPrefix() + '-input'"
            class="wide"
            [nzPlaceHolder]="optional() ? 'Keep the current grade' : 'Choose a grade'"
            [class.invalid]="error()"
            [nzOptions]="options()"
            [ngModel]="value()"
            (ngModelChange)="choose($event)"
            [ngModelOptions]="{ standalone: true }"
            [appSelectInputAttrs]="inputAttrs()"
          />
          @if (hint()) {
            <p class="help" [id]="idPrefix() + '-hint'" data-testid="grade-hint">{{ hint() }}</p>
          }
          @if (error(); as message) {
            <p class="field-error" [id]="idPrefix() + '-error'" role="alert" data-testid="grade-error">{{ message }}</p>
          }
        </div>
      }
      @case ('error') {
        <p class="field-error" role="alert" data-testid="grade-load-error">
          {{ loadFailed }}
          <button type="button" class="link" (click)="reload()">Try again</button>
        </p>
      }
    }
  `,
})
export class LearnerGradeFieldComponent {
  private readonly grades = inject(GradeService);

  /** The learner's primary curriculum, or null before one is chosen. */
  readonly curriculumId = input<string | null>(null);
  readonly curriculumName = input('');
  /** The grade chosen (two-way). Cleared when it does not belong to the curriculum. */
  readonly value = model<string | null>(null);
  /** The learner's own grade, chosen when it belongs to the curriculum and nothing else is chosen. */
  readonly preferred = input<string | null>(null);
  /** Choosing is not required (an edit that keeps the primary curriculum: the server keeps the learner's grade). */
  readonly optional = input(false);
  /** The message beside the select; shown only while the select is. */
  readonly error = input<string | null>(null);
  readonly idPrefix = input('learner-grade');

  /** What the grades came to, for the form. */
  readonly stateChange = output<GradeState>();

  readonly loadFailed = GRADE_LOAD_FAILED_MESSAGE;
  private readonly load = signal<GradeLoad>('idle');
  readonly options = signal<GradeOption[]>([]);
  readonly kind = computed(() => gradeKind(this.load(), this.options()));
  readonly line = computed(() => gradeLine(this.options()[0]?.label ?? ''));
  readonly hint = computed(() => gradeHint(this.curriculumName()));
  readonly inputAttrs = computed(() => ({
    'aria-describedby': [this.hint() ? this.idPrefix() + '-hint' : '', this.error() ? this.idPrefix() + '-error' : ''].filter(Boolean).join(' ') || null,
    'aria-required': this.optional() ? null : 'true',
    'aria-invalid': this.error() ? 'true' : null,
  }));

  /** Which read is current: an answer for a curriculum chosen earlier is dropped. */
  private read = 0;
  private loadedFor: string | null = null;

  constructor() {
    effect(() => {
      const id = this.curriculumId();
      untracked(() => this.begin(id));
    });
    // The form is told whenever what the field found changes.
    effect(() => {
      const state: GradeState = { kind: this.kind(), options: this.options(), curriculumId: this.load() === 'idle' ? null : this.loadedFor };
      untracked(() => this.stateChange.emit(state));
    });
  }

  choose(value: string | null): void {
    this.value.set(value);
  }

  reload(): void {
    this.begin(this.curriculumId(), true);
  }

  private begin(id: string | null, force = false): void {
    if (!force && id === this.loadedFor && this.load() !== 'idle') return;
    const read = ++this.read;
    this.options.set([]);
    this.loadedFor = id;
    // A grade chosen for another curriculum is gone the moment the curriculum changes.
    if (this.value() !== null) this.value.set(null);
    if (!id) {
      this.load.set('idle');
      return;
    }
    this.load.set('loading');
    this.grades.getByCurriculum(id).subscribe({
      next: (answer) => {
        if (read !== this.read) return;
        const options = gradeOptionsOf(answer);
        this.options.set(options);
        this.load.set('ready');
        const kept = reconcileGrade(this.value(), options, this.preferred());
        if (kept !== this.value()) this.value.set(kept);
      },
      error: () => {
        if (read !== this.read) return;
        this.load.set('error');
      },
    });
  }
}
