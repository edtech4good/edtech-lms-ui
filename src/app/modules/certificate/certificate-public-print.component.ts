import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { CertificateSheetComponent } from './certificate-sheet.component';
import { CertificateRecord, PaperSize, VerifyAnswer, VerifyValid, longDate, pageRule, recordFromVerify, tidyCode } from './certificate';
import { CertificateService } from './certificate.service';
import { NOT_FOUND_TEXT } from './certificate-check.component';

type PageState =
  | { kind: 'loading' }
  | { kind: 'valid'; answer: VerifyValid; record: CertificateRecord }
  | { kind: 'revoked'; revokedat: string }
  | { kind: 'missing' }
  | { kind: 'error' };

/**
 * The public printable page of a certificate (`v/:shortcode/certificate`). Anyone with the code may open it, signed in or not: it
 * sits outside the authenticated shell and its guards and asks only the public check (no Authorization header, no other call).
 * A valid certificate is the same sheet as the staff print page, in the look the check answers, with the paper toggle and
 * "Print / Save PDF"; a withdrawn one says so and shows no sheet; an unknown code says so.
 */
@Component({
  selector: 'app-certificate-public-print',
  standalone: true,
  imports: [CertificateSheetComponent, RouterLink],
  template: `
    @switch (state().kind) {
      @case ('loading') {
        <p class="note" data-testid="public-loading">Loading the certificate…</p>
      }
      @case ('missing') {
        <main class="note-page">
          <p class="note" data-testid="public-missing">{{ notFoundText }}</p>
          <a routerLink="/v" data-testid="public-back">Check a code</a>
        </main>
      }
      @case ('error') {
        <main class="note-page">
          <p class="note" role="alert" data-testid="public-error">The certificate could not be shown just now. Try again in a moment.</p>
        </main>
      }
      @case ('revoked') {
        <main class="note-page">
          <p class="note" data-testid="public-revoked">This certificate was withdrawn on {{ revokedOn() }}.</p>
        </main>
      }
    }
    @if (valid(); as v) {
      <div class="toolbar" data-testid="print-toolbar">
        <a [routerLink]="['/v', v.answer.shortcode]" class="back" data-testid="public-check-link">‹ Certificate check</a>
        <div class="paper" role="group" aria-label="Paper size">
          @for (size of sizes; track size) {
            <button type="button" class="size" [class.on]="paper() === size" [attr.aria-pressed]="paper() === size" [attr.data-testid]="'paper-' + size" (click)="paper.set(size)">{{ size }}</button>
          }
        </div>
        <button type="button" class="print" data-testid="print-button" (click)="print()">Print / Save PDF</button>
      </div>
      <div class="paperwrap" [class.a3]="paper() === 'A3'" data-testid="paper" [attr.data-paper]="paper()">
        <app-certificate-sheet [certificate]="v.record" [look]="v.answer.look ?? 'school'" [origin]="origin" [paper]="paper()"></app-certificate-sheet>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 16px;
        font-family: 'Poppins', system-ui, sans-serif;
        color: #2b3a4b;
      }
      .note-page {
        max-width: 520px;
        margin: 48px auto;
      }
      .note {
        font-size: 18px;
        font-weight: 600;
        color: #09101d;
      }
      .toolbar {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .back {
        font-weight: 600;
      }
      .paper {
        display: inline-flex;
        border-radius: 999px;
        box-shadow: inset 0 0 0 1.5px #e3e8ef;
        overflow: hidden;
      }
      .size {
        border: 0;
        background: transparent;
        padding: 6px 16px;
        font: 600 14px/1.5 'Poppins', system-ui, sans-serif;
        cursor: pointer;
      }
      .size.on {
        background: #0b5fff;
        color: #fff;
      }
      .print {
        border: 0;
        border-radius: 999px;
        background: #0b5fff;
        color: #fff;
        padding: 8px 20px;
        font: 600 14px/1.5 'Poppins', system-ui, sans-serif;
        cursor: pointer;
      }
      .paperwrap {
        max-width: 1123px;
      }
      .paperwrap.a3 {
        max-width: 1588px;
      }
      @media print {
        :host {
          padding: 0;
        }
        .toolbar {
          display: none;
        }
        .paperwrap,
        .paperwrap.a3 {
          max-width: none;
        }
      }
    `,
  ],
})
export class CertificatePublicPrintComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(CertificateService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly notFoundText = NOT_FOUND_TEXT;
  readonly sizes: PaperSize[] = ['A4', 'A3'];
  readonly paper = signal<PaperSize>('A4');
  readonly state = signal<PageState>({ kind: 'loading' });
  readonly origin = this.document.location.origin;
  private style: HTMLStyleElement | null = null;

  constructor() {
    // the same paper rule and print stylesheet as the staff print page (styles.less, `body.cert-print`)
    this.document.body.classList.add('cert-print');
    this.style = this.document.createElement('style');
    this.style.id = 'certificate-page-rule';
    this.document.head.appendChild(this.style);
    effect(() => {
      if (this.style) this.style.textContent = pageRule(this.paper());
    });
    this.destroyRef.onDestroy(() => {
      this.document.body.classList.remove('cert-print');
      this.style?.remove();
    });

    this.route.paramMap
      .pipe(
        switchMap((params) =>
          this.service.verify(tidyCode(params.get('shortcode') ?? '')).pipe(
            map((answer): PageState => this.stateOf(answer)),
            // a 404 is "no certificate has this code"; anything else is a failure
            catchError((err) => of<PageState>(err?.status === 404 ? { kind: 'missing' } : { kind: 'error' })),
            startWith<PageState>({ kind: 'loading' }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.state.set(s));
  }

  private stateOf(answer: VerifyAnswer): PageState {
    return answer.status === 'valid' ? { kind: 'valid', answer, record: recordFromVerify(answer) } : { kind: 'revoked', revokedat: answer.revokedat };
  }

  valid() {
    const s = this.state();
    return s.kind === 'valid' ? s : null;
  }
  revokedOn(): string {
    const s = this.state();
    return s.kind === 'revoked' ? longDate(s.revokedat) : '';
  }

  print(): void {
    window.print();
  }
}
