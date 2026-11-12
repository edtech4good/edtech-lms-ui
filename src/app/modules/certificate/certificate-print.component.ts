import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, OnInit, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrganisationService } from '../organisation/organisation.service';
import { CertificateSheetComponent } from './certificate-sheet.component';
import { CertificateLook, CertificateRecord, LOAD_FAILED, PaperSize, isRevoked, lookFor, pageRule } from './certificate';
import { sayFailure } from './certificate-errors';
import { CertificateService } from './certificate.service';

/**
 * The print page of one certificate (`certificates/:certificateid/print`): the certificate on screen with a paper toggle (A4 landscape
 * by default, A3 landscape) and "Print / Save PDF", which is the browser's print. While it is open the admin shell is hidden from the
 * paper (styles.less, `body.cert-print`) and a `@page` rule sets the size. A revoked certificate shows the REVOKED mark and cannot
 * be printed. The look is the organisation's: corporate when its UI theme says so, otherwise the school look.
 */
@Component({
  selector: 'app-certificate-print',
  standalone: true,
  imports: [CertificateSheetComponent, RouterLink],
  template: `
    <div class="toolbar" data-testid="print-toolbar">
      <a routerLink="/certificates" class="back">‹ Certificates</a>
      <div class="paper" role="group" aria-label="Paper size">
        @for (size of sizes; track size) {
          <button type="button" class="size" [class.on]="paper() === size" [attr.aria-pressed]="paper() === size" [attr.data-testid]="'paper-' + size" (click)="paper.set(size)">{{ size }}</button>
        }
      </div>
      <button type="button" class="print" data-testid="print-button" [disabled]="!certificate() || revoked()" (click)="print()">Print / Save PDF</button>
    </div>
    @if (error()) {
      <p class="error" role="alert" data-testid="print-error">{{ error() }}</p>
    }
    @if (revoked()) {
      <p class="warn" data-testid="print-revoked-note">This certificate has been revoked, so it cannot be printed.</p>
    }
    @if (lookFailed()) {
      <p class="warn" data-testid="print-look-note">Could not read the organisation's look; showing the school look.</p>
    }
    @if (revoked()) {
      <p class="print-only" data-testid="print-revoked-print">REVOKED: this certificate has been withdrawn and is not valid.</p>
    }
    @if (certificate(); as cert) {
      @if (lookKnown()) {
      <div class="paperwrap" [class.revoked]="revoked()" [class.a3]="paper() === 'A3'" data-testid="paper" [attr.data-paper]="paper()">
        <app-certificate-sheet [certificate]="cert" [look]="look()" [origin]="origin"></app-certificate-sheet>
      </div>
      }
    } @else if (!error()) {
      <p data-testid="print-loading">Loading the certificate…</p>
    }
  `,
  styles: [
    `
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
        box-shadow: inset 0 0 0 1.5px var(--color-edge, #e3e8ef);
        overflow: hidden;
      }
      .size {
        border: 0;
        background: transparent;
        padding: 6px 16px;
        font: 600 14px/1.5 var(--font-body, sans-serif);
        cursor: pointer;
      }
      .size.on {
        background: var(--color-action, #0b5fff);
        color: #fff;
      }
      .print {
        border: 0;
        border-radius: 999px;
        background: var(--color-action, #0b5fff);
        color: #fff;
        padding: 8px 20px;
        font: 600 14px/1.5 var(--font-body, sans-serif);
        cursor: pointer;
      }
      .print[disabled] {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .error {
        color: var(--color-danger, #b3261e);
      }
      .warn {
        color: #c7420a;
        font-weight: 600;
      }
      .paperwrap {
        max-width: 1123px;
      }
      /* an A3 sheet is the same drawing, shown as it is on paper: half again as wide as A4 as far as the screen allows */
      .paperwrap.a3 {
        max-width: 1588px;
      }
      .print-only {
        display: none;
      }
      @media print {
        .print-only {
          display: block;
          font: 700 24px/1.5 var(--font-body, sans-serif);
        }
        /* a revoked certificate does not print: only the notice above does */
        .paperwrap.revoked {
          display: none;
        }
        .toolbar,
        .warn,
        .error {
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
export class CertificatePrintComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly certificates = inject(CertificateService);
  private readonly organisations = inject(OrganisationService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly sizes: PaperSize[] = ['A4', 'A3'];
  readonly paper = signal<PaperSize>('A4');
  readonly certificate = signal<CertificateRecord | null>(null);
  readonly look = signal<CertificateLook>('school');
  /** The sheet is drawn once the look is known, so it does not change under the reader. */
  readonly lookKnown = signal(false);
  readonly lookFailed = signal(false);
  readonly error = signal('');
  readonly origin = this.document.location.origin;
  private style: HTMLStyleElement | null = null;

  constructor() {
    this.document.body.classList.add('cert-print');
    this.style = this.document.createElement('style');
    this.style.id = 'certificate-page-rule';
    this.document.head.appendChild(this.style);
    // the @page rule follows the toggle, so what the browser prints is the size shown
    effect(() => {
      if (this.style) this.style.textContent = pageRule(this.paper());
    });
    this.destroyRef.onDestroy(() => {
      this.document.body.classList.remove('cert-print');
      this.style?.remove();
    });
  }

  revoked = () => isRevoked(this.certificate());

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('certificateid') ?? '';
    this.certificates
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (certificate) => this.certificate.set(certificate),
        error: (err) => this.error.set(err?.status === 404 ? 'No such certificate.' : sayFailure(err, LOAD_FAILED.replace('learners', 'certificate'))),
      });
    // The look is the organisation's; where it cannot be read (a platform account acting in none, a failed read) it is the school look.
    this.organisations
      .mine()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (org) => {
          this.look.set(lookFor(org?.uitheme));
          this.lookKnown.set(true);
        },
        error: () => {
          this.lookFailed.set(true);
          this.look.set('school');
          this.lookKnown.set(true);
        },
      });
  }

  print(): void {
    if (this.revoked()) return;
    window.print();
  }
}
