import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { FAILURES_SHOWN_BY_CALLER } from 'src/app/interceptors/error-context';
import { CoreService } from 'src/app/services/core.service';
import { TranslationCoverage, TranslationList, TranslationView } from './translations.model';

/**
 * The translation routes of the central API (edtech-lms-api, `src/modules/translations`) and the coverage counts that
 * come with a curriculum's publication overview. Every failure of these calls is said by the caller in one keyed notice
 * (translations.model.ts, `translationErrorMessage`), so the error interceptor stays quiet for them.
 */
@Injectable({ providedIn: 'root' })
export class TranslationsService {
  private readonly http = inject(HttpClient);
  private readonly core = inject(CoreService);

  private readonly context = () => new HttpContext().set(FAILURES_SHOWN_BY_CALLER, true);

  private url(path: string): string {
    return `${this.core.CORE_API()}${path}`;
  }

  /** Every translation of the row, in every language, each marked stale when the row's text has changed since. */
  list(tablename: string, rowid: string): Observable<TranslationList> {
    return this.http
      .get<{ data: TranslationList }>(this.url(`translations/${tablename}/${rowid}`), { context: this.context() })
      .pipe(map((r) => r.data));
  }

  /** Saves the given texts in one language (`fields`: `<field>` or `<field>.<subkey>` -> text). */
  put(tablename: string, rowid: string, language: string, fields: Record<string, string>): Observable<TranslationView[]> {
    return this.http
      .put<{ data: TranslationList }>(this.url(`translations/${tablename}/${rowid}`), { language, fields }, { context: this.context() })
      .pipe(map((r) => r.data.translations));
  }

  /** Removes every translation of the row in one language. */
  remove(tablename: string, rowid: string, language: string): Observable<number> {
    return this.http
      .delete<{ data: { deleted: number } }>(this.url(`translations/${tablename}/${rowid}/${encodeURIComponent(language)}`), {
        context: this.context(),
      })
      .pipe(map((r) => r.data.deleted));
  }

  /** The curriculum's publication overview, of which only the translation counts are read. */
  coverage(curriculumid: string): Observable<TranslationCoverage | null> {
    return this.http
      .get<{ data: { translationcoverage: TranslationCoverage | null } }>(this.url(`curriculum/publication/${curriculumid}`), {
        context: this.context(),
      })
      .pipe(map((r) => r.data.translationcoverage ?? null));
  }
}
