import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
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
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { confirmDialog } from './confirm-dialog';
import {
  DEFAULT_TILE_COLOUR,
  FieldKey,
  SWATCHES,
  codeError,
  countriesError,
  knownBranding,
  nameError,
  serverFieldErrors,
  shortNameError,
  tileTextColour,
} from './organisation-form';
import {
  Country,
  Organisation,
  OrganisationBranding,
  OrganisationPreset,
} from './organisation.model';
import { OrganisationService } from './organisation.service';

const PRESETS: Array<{ value: OrganisationPreset; title: string; help: string; tone: string }> = [
  {
    value: 'company',
    title: 'Company',
    help: 'Curriculum › Module › Lesson. Learners are grouped in cohorts.',
    tone: 'teal',
  },
  {
    value: 'schoolnetwork',
    title: 'School network',
    help: 'Curriculum › Grade › Level › Lesson. Learners are grouped in classes inside schools.',
    tone: 'violet',
  },
];

const FIELD_ORDER: FieldKey[] = ['organisationname', 'organisationshortname', 'organisationcode', 'countryids'];

/**
 * The New / Edit organisation drawer (design o2). One component for both: with an
 * `organisation` it edits that one (the code and the starting point are shown but
 * cannot change); without, it creates.
 *
 * Validation failures are shown beside their fields, never as a toast: the form
 * checks what it can before sending, and the API's 400 and 409 are mapped to the
 * field they name (organisation-form.ts).
 */
@Component({
  selector: 'app-organisation-drawer',
  standalone: true,
  imports: [FormsModule, NzButtonModule, NzDrawerModule, NzSelectModule],
  templateUrl: './organisation-drawer.component.html',
  styleUrl: './organisation-drawer.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganisationDrawerComponent {
  private readonly service = inject(OrganisationService);
  private readonly modal = inject(NzModalService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly open = input(false);
  /** The organisation to edit; null to create a new one. */
  readonly organisation = input<Organisation | null>(null);

  /** The saved organisation. The parent closes the drawer and refreshes the list. */
  readonly saved = output<{ organisation: Organisation; created: boolean }>();
  readonly closed = output<void>();

  readonly presets = PRESETS;

  // ---- Form values ---------------------------------------------------------
  readonly name = signal('');
  readonly shortName = signal('');
  readonly code = signal('');
  readonly preset = signal<OrganisationPreset>('company');
  readonly colour = signal<string>(DEFAULT_TILE_COLOUR);
  readonly countryIds = signal<string[]>([]);

  /** Branding keys the form does not edit (a logo, a display name): kept as they are. */
  private otherBranding: OrganisationBranding = {};
  private initial = '';

  // ---- State ---------------------------------------------------------------
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly touched = signal<ReadonlySet<FieldKey>>(new Set());
  readonly serverErrors = signal<Partial<Record<FieldKey, string>>>({});
  readonly formError = signal<string | null>(null);

  readonly countries = signal<Country[]>([]);
  readonly countriesState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');

  readonly isEdit = computed(() => this.organisation() !== null);
  readonly title = computed(() => (this.isEdit() ? 'Edit organisation' : 'New organisation'));

  /** What is wrong with each field right now, by our own rules. */
  private readonly clientErrors = computed<Record<FieldKey, string | null>>(() => ({
    organisationname: nameError(this.name()),
    organisationshortname: shortNameError(this.shortName()),
    organisationcode: this.isEdit() ? null : codeError(this.code()),
    countryids: countriesError(this.countryIds()),
  }));

  /** The message to show for a field: ours once it has been touched or submitted, the API's always. */
  readonly errors = computed<Record<FieldKey, string | null>>(() => {
    const client = this.clientErrors();
    const server = this.serverErrors();
    const show = (key: FieldKey) =>
      (this.submitted() || this.touched().has(key) ? client[key] : null) ?? server[key] ?? null;
    return {
      organisationname: show('organisationname'),
      organisationshortname: show('organisationshortname'),
      organisationcode: show('organisationcode'),
      countryids: show('countryids'),
    };
  });

  /** The swatches, plus the organisation's own colour if it is not one of the five. */
  readonly choices = computed(() => {
    const c = this.colour();
    return SWATCHES.some((s) => s.colour.toLowerCase() === c.toLowerCase())
      ? [...SWATCHES]
      : [...SWATCHES, { name: 'Current colour', colour: c }];
  });

  /** The platform's countries as the select's options. */
  readonly countryOptions = computed(() =>
    this.countries().map((c) => ({ label: c.countryname, value: c.countryid })),
  );

  readonly tileInk = computed(() => tileTextColour(this.colour()));

  readonly dirty = computed(() => this.snapshot() !== this.initial);

  readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  readonly shortNameInput = viewChild<ElementRef<HTMLInputElement>>('shortNameInput');
  readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');
  readonly submitButton = viewChild<ElementRef<HTMLButtonElement>>('submitButton');

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => this.begin());
      }
    });
    // The drawer builds its content after it opens: focus goes to the first field
    // as soon as that exists.
    effect(() => {
      const first = this.nameInput();
      if (first && this.open()) {
        // ng-zorro's own focus trap also moves focus (to the first thing it finds)
        // while the drawer settles: try again until focus is on a field of the form.
        for (const delay of [0, 150, 400]) {
          setTimeout(() => {
            const active = document.activeElement;
            const onField = active instanceof HTMLElement && active.closest('form#org-form') !== null;
            if (this.open() && !onField) first.nativeElement.focus();
          }, delay);
        }
      }
    });
  }

  private snapshot(): string {
    return JSON.stringify([
      this.name().trim(),
      this.shortName(),
      this.code(),
      this.preset(),
      this.colour().toLowerCase(),
      [...this.countryIds()].sort(),
    ]);
  }

  /** Fill the form from the organisation (or empty it), and load the countries once. */
  private begin(): void {
    const org = this.organisation();
    this.submitting.set(false);
    this.submitted.set(false);
    this.touched.set(new Set());
    this.serverErrors.set({});
    this.formError.set(null);
    this.name.set(org?.organisationname ?? '');
    this.shortName.set(org?.organisationshortname ?? '');
    this.code.set(org?.organisationcode ?? '');
    this.preset.set(org?.organisationpreset ?? 'company');
    const known = knownBranding(org?.brandingconfig) ?? {};
    const { tilecolour, ...rest } = known;
    this.colour.set(tilecolour ?? DEFAULT_TILE_COLOUR);
    this.otherBranding = rest;
    this.countryIds.set(org?.countries.map((c) => c.countryid) ?? []);
    this.initial = this.snapshot();
    if (this.countriesState() !== 'ready') {
      this.loadCountries();
    }
  }

  loadCountries(): void {
    this.countriesState.set('loading');
    this.service.countries().subscribe({
      next: (list) => {
        this.countries.set(list);
        this.countriesState.set('ready');
      },
      error: () => this.countriesState.set('error'),
    });
  }

  // ---- Field handlers ------------------------------------------------------
  touch(key: FieldKey): void {
    this.touched.update((s) => new Set(s).add(key));
  }

  private clearServer(key: FieldKey): void {
    if (this.serverErrors()[key] || this.formError()) {
      this.serverErrors.update((all) => {
        const { [key]: _gone, ...rest } = all;
        return rest;
      });
      this.formError.set(null);
    }
  }

  setName(value: string): void {
    this.name.set(value);
    this.clearServer('organisationname');
  }
  setShortName(value: string): void {
    this.shortName.set(value);
    this.clearServer('organisationshortname');
  }
  setCode(value: string): void {
    this.code.set(value);
    this.clearServer('organisationcode');
  }
  setCountries(ids: string[]): void {
    this.countryIds.set(ids ?? []);
    this.touch('countryids');
    this.clearServer('countryids');
  }

  // ---- Closing -------------------------------------------------------------
  /** The close button, Cancel, Escape and a click on the dimmed page all come here. */
  requestClose(): void {
    if (this.submitting()) return;
    if (!this.dirty()) {
      this.closed.emit();
      return;
    }
    confirmDialog(this.modal, {
      nzTitle: 'Discard your changes?',
      nzContent: this.isEdit()
        ? "The changes to this organisation haven't been saved."
        : "This organisation hasn't been created yet.",
      nzOkText: 'Discard changes',
      nzOkDanger: true,
      nzCancelText: 'Keep editing',
      nzOnOk: () => this.closed.emit(),
    });
  }

  // ---- Submitting ----------------------------------------------------------
  submit(): void {
    // A double-click or a second Enter can arrive before the button is disabled.
    if (this.submitting()) return;
    this.submitted.set(true);
    const errors = this.clientErrors();
    const first = FIELD_ORDER.find((k) => errors[k]);
    if (first) {
      this.focusField(first);
      return;
    }
    const branding: OrganisationBranding = { ...this.otherBranding, tilecolour: this.colour() };
    const write = {
      organisationname: this.name().trim(),
      organisationshortname: this.shortName(),
      brandingconfig: branding,
      countryids: this.countryIds(),
    };
    this.submitting.set(true);
    const org = this.organisation();
    const request = org
      ? this.service.update(org.organisationid, write)
      : this.service.create({
          ...write,
          organisationcode: this.code(),
          organisationpreset: this.preset(),
          // The look follows the starting point, chosen once, at creation.
          uitheme: this.preset() === 'company' ? 'corporate' : 'kids',
        });
    request.subscribe({
      next: (saved) => {
        this.submitting.set(false);
        this.saved.emit({ organisation: saved, created: !org });
      },
      error: (error: HttpErrorResponse) => this.failed(error),
    });
  }

  private failed(error: HttpErrorResponse): void {
    this.submitting.set(false);
    const { fields, form } = serverFieldErrors(error);
    this.serverErrors.set(fields);
    this.formError.set(form ?? null);
    const first = FIELD_ORDER.find((k) => fields[k]);
    // The button was disabled while saving: bring the view up to date, then move focus.
    this.cdr.detectChanges();
    if (first) {
      this.focusField(first);
    } else {
      this.submitButton()?.nativeElement.focus();
    }
  }

  private focusField(key: FieldKey): void {
    const target = {
      organisationname: this.nameInput(),
      organisationshortname: this.shortNameInput(),
      organisationcode: this.codeInput(),
      countryids: undefined,
    }[key];
    if (target) {
      target.nativeElement.focus();
    } else {
      document.getElementById('org-countries')?.querySelector<HTMLElement>('input')?.focus();
    }
  }
}
