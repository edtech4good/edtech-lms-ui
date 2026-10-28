import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable, concat, last, of } from 'rxjs';
import { confirmDialog } from 'src/app/modules/organisation/confirm-dialog';
import { TranslationsService } from './translations.service';
import {
  Changes,
  TRANSLATIONS_TOAST_KEY,
  TextItem,
  TranslationView,
  canSave,
  changesFor,
  checkLanguageCode,
  initialDraft,
  languageLabel,
  languagesOf,
  normaliseLanguage,
  savedByKey,
  textsOf,
  translationErrorMessage,
} from './translations.model';

type Drafts = Record<string, Record<string, string>>;
type Confirmed = Record<string, string[]>;

/**
 * The Translations side panel of a content editor (design: docs/bilingual-content-design.md, decision 5).
 *
 * A "Translations" button that opens a right-hand drawer listing the translatable texts of the row opened in the editor:
 * the base text read-only, and one input per language the organisation already translates into, with an "Add language"
 * code input. A text an answer is graded by is shown as "Not translatable". A translation whose base text has changed
 * since is marked "Base text changed"; saving sends only what was typed, so an old translation is never quietly marked
 * current (it can be confirmed with "Still correct").
 *
 * There is no drawn reference for this panel. It follows the closest existing side panel, the organisation drawer
 * (modules/organisation, handoff-v2 "Admin v2.1 Platform and Settings", artboard o2): the same frame (class
 * "org-drawer"), header, field, hint and footer rhythm, and the same tokens.
 *
 * The panel works on the row as the editor loaded it (`row`), which is what the server holds: a translation is of the saved
 * text. Every failure of a translations call is one keyed notice, with the API's own words for a 400.
 */
@Component({
  selector: 'app-translations-panel',
  standalone: true,
  imports: [FormsModule, NzButtonModule, NzDrawerModule],
  templateUrl: './translations-panel.component.html',
  styleUrl: './translations-panel.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TranslationsPanelComponent {
  private readonly service = inject(TranslationsService);
  private readonly modal = inject(NzModalService);
  private readonly notification = inject(NzNotificationService);

  /** The table of the row (`lessons`, `questions`, ...). */
  readonly tablename = input.required<string>();
  /** The row's id; null until the editor has loaded it. */
  readonly rowid = input<string | null | undefined>(null);
  /** The row as the editor loaded it (the base text). */
  readonly row = input<object | null | undefined>(null);
  /** What the row is called in the panel's header ("Lesson", "Question"). */
  readonly what = input('this');

  readonly open = signal(false);
  readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly saving = signal(false);
  readonly contentLanguage = signal<string | null>(null);
  readonly translations = signal<TranslationView[]>([]);
  readonly languages = signal<string[]>([]);
  readonly active = signal<string | null>(null);
  readonly drafts = signal<Drafts>({});
  readonly confirmed = signal<Confirmed>({});
  readonly addCode = signal('');
  readonly addError = signal<string | null>(null);

  readonly items = computed<TextItem[]>(() => textsOf(this.tablename(), this.row() as Record<string, unknown> | null | undefined));
  readonly translatable = computed(() => this.items().filter((i) => !i.answerBearing));
  readonly baseLabel = computed(() => {
    const code = this.contentLanguage();
    return code === null ? null : languageLabel(code);
  });

  /** What each language would send now. */
  readonly changes = computed<Record<string, Changes>>(() => {
    const out: Record<string, Changes> = {};
    for (const language of this.languages()) {
      out[language] = changesFor(
        this.items(),
        savedByKey(this.translations(), language),
        this.drafts()[language] ?? {},
        new Set(this.confirmed()[language] ?? []),
      );
    }
    return out;
  });
  readonly dirty = computed(() => Object.values(this.changes()).some((c) => Object.keys(c.fields).length > 0 || c.blanked.length > 0));
  readonly canSaveAll = computed(() => {
    const all = Object.values(this.changes());
    return all.some(canSave) && all.every((c) => c.blanked.length === 0 && c.tooLong.length === 0);
  });

  readonly activeSaved = computed(() => savedByKey(this.translations(), this.active() ?? ''));
  readonly activeChanges = computed(() => this.changes()[this.active() ?? ''] ?? null);

  label = languageLabel;

  /** How many of the language's texts have a translation (shown on its tab). */
  doneCount(language: string): number {
    const saved = savedByKey(this.translations(), language);
    return this.translatable().filter((i) => saved.has(i.key)).length;
  }

  // ---- Opening and loading ---------------------------------------------------------------
  show(): void {
    this.open.set(true);
    this.load();
  }

  load(keepDrafts = false): void {
    const id = this.rowid();
    if (!id) return;
    this.state.set('loading');
    this.service.list(this.tablename(), id).subscribe({
      next: (list) => {
        this.contentLanguage.set(list.contentlanguage);
        this.translations.set(list.translations);
        const known = languagesOf(list.translations);
        const added = keepDrafts ? this.languages().filter((l) => !known.includes(l)) : [];
        const all = [...known, ...added];
        this.languages.set(all);
        const drafts: Drafts = {};
        for (const language of all) {
          const fresh = initialDraft(this.items(), savedByKey(list.translations, language));
          drafts[language] = keepDrafts && this.drafts()[language] ? { ...fresh, ...this.drafts()[language] } : fresh;
        }
        this.drafts.set(drafts);
        if (!keepDrafts) this.confirmed.set({});
        const current = this.active();
        this.active.set(current !== null && all.includes(current) ? current : (all[0] ?? null));
        this.state.set('ready');
      },
      error: (e: HttpErrorResponse) => {
        this.state.set('error');
        this.say(e);
      },
    });
  }

  requestClose(): void {
    if (this.saving()) return;
    if (!this.dirty()) {
      this.open.set(false);
      return;
    }
    confirmDialog(this.modal, {
      nzTitle: 'Discard your changes?',
      nzContent: "The translations you typed haven't been saved.",
      nzOkText: 'Discard changes',
      nzOkDanger: true,
      nzCancelText: 'Keep editing',
      nzOnOk: () => this.open.set(false),
    });
  }

  // ---- Languages -------------------------------------------------------------------------
  select(language: string): void {
    this.active.set(language);
  }

  setAddCode(value: string): void {
    this.addCode.set(value);
    this.addError.set(null);
  }

  addLanguage(): void {
    const checked = checkLanguageCode(this.addCode(), this.contentLanguage(), this.languages());
    if (checked.error !== null) {
      this.addError.set(checked.error);
      return;
    }
    const code = checked.code;
    this.languages.update((l) => [...l, code]);
    this.drafts.update((d) => ({ ...d, [code]: initialDraft(this.items(), new Map()) }));
    this.active.set(code);
    this.addCode.set('');
    this.addError.set(null);
  }

  removeLanguage(language: string): void {
    const hasSaved = this.translations().some((t) => t.language.toLowerCase() === language.toLowerCase());
    confirmDialog(this.modal, {
      nzTitle: `Remove ${languageLabel(language)}?`,
      nzContent: hasSaved
        ? `Every ${languageLabel(language)} translation of ${this.what() === 'this' ? 'this' : `this ${this.what().toLowerCase()}`} will be deleted. This can't be undone.`
        : 'Nothing has been saved in this language yet.',
      nzOkText: 'Remove language',
      nzOkDanger: true,
      nzCancelText: 'Keep it',
      nzOnOk: () => {
        if (!hasSaved) {
          this.dropLocally(language);
          return;
        }
        this.service.remove(this.tablename(), this.rowid() as string, language).subscribe({
          next: () => {
            this.dropLocally(language);
            this.translations.update((all) => all.filter((t) => t.language.toLowerCase() !== language.toLowerCase()));
            this.notification.create('success', 'Removed', `${languageLabel(language)} translations were removed.`);
          },
          error: (e: HttpErrorResponse) => this.say(e),
        });
      },
    });
  }

  private dropLocally(language: string): void {
    const left = this.languages().filter((l) => l !== language);
    this.languages.set(left);
    this.drafts.update(({ [language]: _gone, ...rest }) => rest);
    this.confirmed.update(({ [language]: _gone, ...rest }) => rest);
    if (this.active() === language) this.active.set(left[0] ?? null);
  }

  // ---- Typing -----------------------------------------------------------------------------
  draftOf(language: string, key: string): string {
    return this.drafts()[language]?.[key] ?? '';
  }

  setDraft(language: string, key: string, value: string): void {
    this.drafts.update((d) => ({ ...d, [language]: { ...(d[language] ?? {}), [key]: value } }));
  }

  isStale(item: TextItem): boolean {
    const t = this.activeSaved().get(item.key);
    return !!t && t.stale && !this.isConfirmed(item.key);
  }

  isConfirmed(key: string): boolean {
    return (this.confirmed()[this.active() ?? ''] ?? []).includes(key);
  }

  confirmStill(key: string): void {
    const language = this.active();
    if (language === null) return;
    this.confirmed.update((c) => ({ ...c, [language]: [...(c[language] ?? []), key] }));
  }

  problemOf(key: string): string | null {
    const c = this.activeChanges();
    if (!c) return null;
    if (c.blanked.includes(key)) return "A translation can't be blank. Type its text, or remove the language to delete them all.";
    if (c.tooLong.includes(key)) return 'That text is too long.';
    return null;
  }

  // ---- Saving -----------------------------------------------------------------------------
  save(): void {
    if (this.saving() || !this.canSaveAll()) return;
    const id = this.rowid() as string;
    const sends: Array<Observable<unknown>> = [];
    const saved: string[] = [];
    for (const [language, c] of Object.entries(this.changes())) {
      if (!canSave(c)) continue;
      saved.push(language);
      // One PUT per language, one after the other: two saves of one row never overlap.
      sends.push(this.service.put(this.tablename(), id, language, c.fields));
    }
    this.saving.set(true);
    concat(...sends, of(null))
      .pipe(last())
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.confirmed.update((c) => {
            const next = { ...c };
            for (const language of saved) delete next[language];
            return next;
          });
          // Drafts are replaced by what is saved now (the stale flags are the server's).
          this.drafts.set({});
          this.load(true);
          this.notification.create('success', 'Saved', 'Translations saved.');
        },
        error: (e: HttpErrorResponse) => {
          this.saving.set(false);
          this.say(e);
          // Whatever was saved before the failure is on the server: show it, keep what was typed.
          this.load(true);
        },
      });
  }

  /** One keyed notice for a failed call: a repeat replaces the one showing. */
  private say(e: HttpErrorResponse): void {
    this.notification.create('error', 'Error', translationErrorMessage(e.status, e.error), { nzKey: TRANSLATIONS_TOAST_KEY });
  }

  readonly normalise = normaliseLanguage;
}
