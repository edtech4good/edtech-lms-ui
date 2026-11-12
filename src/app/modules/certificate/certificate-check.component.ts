import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap, of, catchError, map, startWith } from 'rxjs';
import { VerifyAnswer, longDate, tidyCode } from './certificate';
import { CertificateService } from './certificate.service';

export const NOT_FOUND_TEXT = 'No certificate has this code';

type CheckState = { kind: 'ask' } | { kind: 'loading' } | { kind: 'answer'; answer: VerifyAnswer } | { kind: 'missing' } | { kind: 'error' };

/**
 * The public check of a certificate (`v/:shortcode`, and `v` for typing a code). Anyone with the code or the QR may open it, signed
 * in or not: it sits outside the authenticated shell and its guards, asks the one public route (no Authorization header, no other
 * call) and shows what the certificate itself says. A revoked certificate says so with the date; the reason is never public.
 */
@Component({
  selector: 'app-certificate-check',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="page">
      <div class="card" data-testid="check-card">
        <div class="eyebrow">Certificate check</div>
        @switch (state().kind) {
          @case ('loading') {
            <p data-testid="check-loading">Checking…</p>
          }
          @case ('missing') {
            <div class="status"><span class="dot bad"></span><span data-testid="check-status">{{ notFoundText }}</span></div>
            <p class="lede" data-testid="check-missing">Check the code and try again. A code looks like 7F3K-92QD.</p>
          }
          @case ('error') {
            <p class="lede" role="alert" data-testid="check-error">The certificate could not be checked just now. Try again in a moment.</p>
          }
        }
        @if (valid(); as v) {
          <div class="status"><span class="dot ok"></span><span data-testid="check-status">Valid certificate</span></div>
          <dl data-testid="check-fields">
            <dt>Awarded to</dt><dd data-testid="check-name">{{ v.learnername }}</dd>
            <dt>For</dt><dd data-testid="check-for">{{ forText(v) }}</dd>
            @if (v.classname) {
              <dt>Cohort</dt><dd data-testid="check-class">{{ v.classname }}</dd>
            }
            <dt>Issued by</dt><dd data-testid="check-org">{{ v.organisationname }}</dd>
            <dt>Issued on</dt><dd data-testid="check-issued">{{ date(v.issuedat) }}</dd>
            <dt>Code</dt><dd class="mono" data-testid="check-code">{{ v.shortcode }}</dd>
          </dl>
          <p class="lede"><a [routerLink]="['/v', v.shortcode, 'certificate']" data-testid="check-show">Show certificate</a></p>
        }
        @if (revoked(); as r) {
          <div class="status"><span class="dot bad"></span><span data-testid="check-status">Revoked</span></div>
          <p class="lede" data-testid="check-revoked-text">This certificate was withdrawn on {{ date(r.revokedat) }}. It is no longer valid.</p>
          <dl data-testid="check-fields"><dt>Code</dt><dd class="mono" data-testid="check-code">{{ r.shortcode }}</dd></dl>
        }
        @if (state().kind === 'ask' || state().kind === 'missing' || state().kind === 'error') {
          <form class="ask" (ngSubmit)="go()">
            <label for="code">Enter the code printed on the certificate</label>
            <div class="row">
              <input id="code" name="code" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" placeholder="XXXX-XXXX" [(ngModel)]="typed" data-testid="check-input" />
              <button type="submit" data-testid="check-submit" [disabled]="!typed.trim()">Check</button>
            </div>
          </form>
        }
      </div>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: #e9edf5;
        font-family: 'Poppins', system-ui, sans-serif;
        color: #2b3a4b;
      }
      .page {
        display: flex;
        justify-content: center;
        padding: 48px 16px;
      }
      .card {
        width: 100%;
        max-width: 520px;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(9, 16, 29, 0.1);
        padding: 24px 28px 28px;
      }
      .eyebrow {
        font-family: 'Space Mono', ui-monospace, monospace;
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #5a6b80;
      }
      .status {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 6px;
        font-weight: 700;
        font-size: 22px;
        color: #09101d;
      }
      .dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        flex: none;
      }
      .dot.ok {
        background: #0f7a4f;
      }
      .dot.bad {
        background: #c7420a;
      }
      .lede {
        font-size: 14px;
        margin: 12px 0 0;
      }
      dl {
        display: grid;
        grid-template-columns: 110px 1fr;
        gap: 6px 12px;
        margin: 16px 0 0;
        font-size: 14px;
      }
      dt {
        color: #5a6b80;
      }
      dd {
        margin: 0;
        color: #09101d;
        font-weight: 500;
      }
      .mono {
        font-family: 'Space Mono', ui-monospace, monospace;
      }
      .ask {
        margin-top: 20px;
      }
      .ask label {
        display: block;
        font-size: 13px;
        color: #5a6b80;
        margin-bottom: 6px;
      }
      .row {
        display: flex;
        gap: 8px;
      }
      input {
        flex: 1;
        min-width: 0;
        padding: 8px 12px;
        font: 600 16px/1.5 'Space Mono', ui-monospace, monospace;
        letter-spacing: 0.1em;
        border: 1.5px solid #c9d2de;
        border-radius: 10px;
        text-transform: uppercase;
      }
      button {
        border: 0;
        border-radius: 999px;
        background: #0b5fff;
        color: #fff;
        padding: 8px 20px;
        font: 600 14px/1.5 'Poppins', system-ui, sans-serif;
        cursor: pointer;
      }
      button[disabled] {
        opacity: 0.45;
        cursor: not-allowed;
      }
      @media (max-width: 480px) {
        dl {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CertificateCheckComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(CertificateService);

  readonly notFoundText = NOT_FOUND_TEXT;
  readonly state = signal<CheckState>({ kind: 'ask' });
  typed = '';
  readonly date = longDate;

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const code = params.get('shortcode');
          if (!code) return of<CheckState>({ kind: 'ask' });
          return this.service.verify(tidyCode(code)).pipe(
            map((answer): CheckState => ({ kind: 'answer', answer })),
            // a 404 is "no certificate has this code" (the same for a code that is not shaped like one); anything else is a failure
            catchError((err) => of<CheckState>(err?.status === 404 ? { kind: 'missing' } : { kind: 'error' })),
            startWith<CheckState>({ kind: 'loading' }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.state.set(s));
  }

  valid() {
    const s = this.state();
    return s.kind === 'answer' && s.answer.status === 'valid' ? s.answer : null;
  }
  revoked() {
    const s = this.state();
    return s.kind === 'answer' && s.answer.status === 'revoked' ? s.answer : null;
  }

  /** "Digital Skills for Small Business (programme)" for the whole curriculum; "Module 3 · Pricing, part of ..." for a level or a grade. */
  forText(v: { scope: 'level' | 'grade' | 'curriculum'; tierlabel: string; scopename: string; curriculumname: string }): string {
    return v.scope === 'curriculum' ? `${v.curriculumname} (programme)` : `${v.scopename}, part of ${v.curriculumname}`;
  }

  go(): void {
    const code = tidyCode(this.typed);
    if (code) void this.router.navigate(['/v', code]);
  }
}
