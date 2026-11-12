import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { CertificateLook, CertificateRecord, longDate, qrDrawing, verifyUrl, wordingFor } from './certificate';

/**
 * The certificate itself, drawn from the snapshot: the corporate look (C1 for a whole curriculum, C2 for a level or a grade) or the
 * school look (S1). Drafted from the design-system tokens as a placeholder look: the dashed boxes (logos, signatures, the Khmer
 * title) are slots the client fills; they show on screen and print as blank space. Nothing here is a Khmer sentence.
 * Sizes are in cqw (one percent of the sheet's width) so A4 and A3 are the same drawing at two sizes.
 */
@Component({
  selector: 'app-certificate-sheet',
  standalone: true,
  template: `
    <div class="sheet" [class.corporate]="look() === 'corporate'" [class.school]="look() === 'school'" [class.a3]="paper() === 'A3'" data-testid="sheet" [attr.data-look]="look()">
      @if (look() === 'corporate') {
        <div class="corp">
          <div class="top">
            <div class="logos">
              <div class="logo slot" data-testid="slot"><span class="slot-label">ORGANISATION LOGO</span></div>
              <div class="logo slot" data-testid="slot"><span class="slot-label">PARTNER / FUNDER LOGO</span></div>
            </div>
            <div class="no">No. {{ certificate().shortcode }}</div>
          </div>
          <div class="eyebrow" data-testid="sheet-eyebrow">{{ words().eyebrow }}</div>
          <div><span class="km-title slot km-slot" data-testid="slot"><span class="slot-label">KHMER TITLE — supplied by the client, reviewed by a native speaker</span></span></div>
          <div class="title" data-testid="sheet-title">{{ words().title }}</div>
          <div class="given">{{ words().given }}</div>
          <div><div class="name" data-testid="sheet-name">{{ certificate().snapshot.learnername }}</div></div>
          <div class="for">
            <span data-testid="sheet-intro">{{ words().intro }}</span><br />
            <b data-testid="sheet-subject">{{ words().subject }}</b>
            @if (words().partOf) {
              <span class="partof" data-testid="sheet-partof">, {{ words().partOf }}</span>
            }
          </div>
          <div class="meta">
            @if (certificate().snapshot.classname) {
              <div><span>Cohort</span><b data-testid="sheet-class">{{ certificate().snapshot.classname }}</b></div>
            }
            <div><span>Issued</span><b data-testid="sheet-issued">{{ issued() }}</b></div>
            @if (certificate().snapshot.organisationname) {
              <div><span>Issued by</span><b>{{ certificate().snapshot.organisationname }}</b></div>
            }
          </div>
          <div class="bottom">
            <div class="sigs">
              <div class="sig"><div class="line slot" data-testid="slot"><span class="slot-label">SIGNATURE</span></div><div class="who slot" data-testid="slot"><span class="slot-label">Signatory name</span></div><div class="role slot" data-testid="slot"><span class="slot-label">Title, organisation</span></div></div>
              <div class="sig"><div class="line slot" data-testid="slot"><span class="slot-label">SIGNATURE</span></div><div class="who slot" data-testid="slot"><span class="slot-label">Signatory name</span></div><div class="role slot" data-testid="slot"><span class="slot-label">Title, organisation</span></div></div>
            </div>
            <ng-container *ngTemplateOutlet="verify"></ng-container>
          </div>
        </div>
      } @else {
        <div class="sch">
          <div class="top">
            <div class="logo slot" data-testid="slot"><span class="slot-label">SCHOOL LOGO</span></div>
            <div class="no">No. {{ certificate().shortcode }}</div>
          </div>
          <svg class="seal" viewBox="0 0 100 100" aria-hidden="true">
            <g fill="#FFC228">
              <circle cx="50" cy="50" r="40" />
              <path d="M50 2l6 10 11-4 2 12 12 2-4 11 10 6-10 6 4 11-12 2-2 12-11-4-6 10-6-10-11 4-2-12-12-2 4-11-10-6 10-6-4-11 12-2 2-12 11 4z" opacity=".55" />
            </g>
            <circle cx="50" cy="50" r="31" fill="#fff" />
            <path d="M50 30l5.9 12 13.1 1.9-9.5 9.3 2.2 13.1L50 60.1l-11.7 6.2 2.2-13.1-9.5-9.3 13.1-1.9z" fill="#FF640D" />
          </svg>
          <div><span class="km-title slot km-slot" data-testid="slot"><span class="slot-label">KHMER TITLE — supplied by the school</span></span></div>
          <div class="title" data-testid="sheet-title">{{ words().title }}</div>
          <div class="given">{{ words().given }}</div>
          <div class="name" data-testid="sheet-name">{{ certificate().snapshot.learnername }}</div>
          <div class="for">
            <span data-testid="sheet-intro">{{ words().intro }}</span>
            <b data-testid="sheet-subject">{{ words().subject }}</b>
            @if (words().partOf) {
              <span data-testid="sheet-partof">, {{ words().partOf }}</span>
            }
          </div>
          <div class="for sub">
            @if (certificate().snapshot.classname) {
              <span data-testid="sheet-class">{{ certificate().snapshot.classname }}</span> ·
            }
            @if (certificate().snapshot.schoolname) {
              {{ certificate().snapshot.schoolname }} ·
            }
            <span data-testid="sheet-issued">{{ issued() }}</span>
          </div>
          <div class="bottom">
            <div class="sig"><div class="line slot" data-testid="slot"><span class="slot-label">SIGNATURE</span></div><div class="who slot" data-testid="slot"><span class="slot-label">Teacher name</span></div><div class="role slot" data-testid="slot"><span class="slot-label">Class teacher</span></div></div>
            <div></div>
            <ng-container *ngTemplateOutlet="verify"></ng-container>
          </div>
        </div>
      }
      <ng-template #verify>
        <div class="verify">
          <div>
            <div class="lbl">Verify</div>
            <div class="code" data-testid="sheet-code">{{ certificate().shortcode }}</div>
            <div class="url" data-testid="sheet-url">{{ url() }}</div>
          </div>
          <svg class="qr" [attr.viewBox]="'0 0 ' + qr().size + ' ' + qr().size" role="img" aria-label="QR code for the check page" data-testid="qr" [attr.data-qr-text]="url()" shape-rendering="crispEdges">
            <rect [attr.width]="qr().size" [attr.height]="qr().size" fill="#fff" />
            <path [attr.d]="qr().path" fill="#09101D" />
          </svg>
        </div>
      </ng-template>
      @if (revoked()) {
        <div class="revoked" data-testid="revoked-mark" role="img" aria-label="This certificate has been revoked">REVOKED</div>
      }
    </div>
  `,
  imports: [NgTemplateOutlet],
  styles: [
    `
      :host {
        display: block;
        --blue: #0b5fff;
        --cyan: #00a2e3;
        --teal: #06afbc;
        --orange: #ff640d;
        --amber: #ffc228;
        --ink: #09101d;
        --body: #2b3a4b;
        --muted: #5a6b80;
        --hair: #e3e8ef;
        --display: 'Poppins', system-ui, sans-serif;
        --sans: 'Poppins', system-ui, sans-serif;
        --mono: 'Space Mono', ui-monospace, monospace;
        --khmer: 'Kantumruy Pro', sans-serif;
      }
      .sheet {
        width: 100%;
        aspect-ratio: 297 / 210;
        background: #fff;
        box-shadow: 0 10px 40px rgba(9, 16, 29, 0.14);
        position: relative;
        overflow: hidden;
        container-type: inline-size;
        color: var(--body);
        font-family: var(--sans);
        line-height: 1.5;
      }
      .slot {
        outline: 1.5px dashed #9aa8bc;
        outline-offset: 2px;
        border-radius: 4px;
        color: #7a889b;
        background: repeating-linear-gradient(135deg, #f7f9fc 0 8px, #eef2f8 8px 16px);
      }
      .km-slot {
        font-family: var(--mono);
        font-size: 1cqw;
        letter-spacing: 0.04em;
        min-width: 34cqw;
        min-height: 2.4cqw;
      }
      .sig .who.slot {
        min-height: 1.3cqw;
      }
      .sig .role.slot {
        min-height: 1.2cqw;
      }
      .corp {
        padding: 5.2cqw 6cqw 4.4cqw 8.4cqw;
        display: flex;
        flex-direction: column;
        height: 100%;
        box-sizing: border-box;
      }
      .corp::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 2.1cqw;
        background: linear-gradient(180deg, var(--blue), var(--cyan) 60%, var(--teal));
      }
      .corp::after {
        content: '';
        position: absolute;
        inset: 1.6cqw 1.6cqw 1.6cqw 3.6cqw;
        border: 0.12cqw solid var(--hair);
        border-radius: 0.8cqw;
        pointer-events: none;
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .logos {
        display: flex;
        gap: 1.6cqw;
      }
      .logo {
        height: 4.6cqw;
        min-width: 13cqw;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--mono);
        font-size: 0.95cqw;
      }
      .no {
        font-family: var(--mono);
        font-size: 0.9cqw;
        letter-spacing: 0.14em;
        color: var(--muted);
        text-transform: uppercase;
      }
      .corp .eyebrow {
        font-family: var(--mono);
        font-size: 1.15cqw;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: var(--blue);
        margin-top: 3.4cqw;
      }
      .km-title {
        display: inline-block;
        padding: 0 0.8cqw;
        line-height: 1.7;
        margin-top: 0.6cqw;
      }
      .corp .title {
        font-family: var(--display);
        font-weight: 700;
        color: var(--ink);
        font-size: 4.4cqw;
        letter-spacing: -0.02em;
        line-height: 1.05;
        margin-top: 0.5cqw;
      }
      .corp .given {
        font-size: 1.35cqw;
        color: var(--muted);
        margin-top: 2.4cqw;
      }
      .corp .name {
        font-family: var(--display);
        font-weight: 700;
        color: var(--ink);
        font-size: 3.9cqw;
        letter-spacing: -0.015em;
        line-height: 1.15;
        margin-top: 0.4cqw;
        padding-bottom: 1cqw;
        border-bottom: 0.15cqw solid var(--ink);
        display: inline-block;
        min-width: 46cqw;
      }
      .corp .for {
        font-size: 1.35cqw;
        margin-top: 1.8cqw;
        max-width: 66cqw;
      }
      .corp .for b {
        font-family: var(--display);
        color: var(--ink);
        font-size: 1.75cqw;
        letter-spacing: -0.01em;
      }
      .meta {
        display: flex;
        gap: 3.2cqw;
        margin-top: 1.6cqw;
        font-size: 1.05cqw;
      }
      .meta div span {
        display: block;
        font-family: var(--mono);
        font-size: 0.82cqw;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .meta div b {
        font-weight: 600;
        color: var(--ink);
      }
      .bottom {
        margin-top: auto;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
      }
      .sigs {
        display: flex;
        gap: 4cqw;
      }
      .sig {
        width: 20cqw;
      }
      .sig .line {
        height: 3.4cqw;
        border-bottom: 0.12cqw solid var(--ink);
        display: flex;
        align-items: flex-end;
        justify-content: center;
        font-family: var(--mono);
        font-size: 0.85cqw;
        padding-bottom: 0.4cqw;
      }
      .sig .who {
        font-weight: 600;
        color: var(--ink);
        font-size: 1.05cqw;
        margin-top: 0.6cqw;
      }
      .sig .role {
        font-size: 0.92cqw;
        color: var(--muted);
      }
      .verify {
        display: flex;
        gap: 1.3cqw;
        align-items: flex-end;
        text-align: right;
      }
      .verify .code {
        font-family: var(--mono);
        font-weight: 700;
        color: var(--ink);
        font-size: 1.35cqw;
        letter-spacing: 0.12em;
      }
      .verify .url {
        font-family: var(--mono);
        font-size: 0.85cqw;
        color: var(--muted);
      }
      .verify .lbl {
        font-family: var(--mono);
        font-size: 0.78cqw;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .qr {
        width: 8.4cqw;
        height: 8.4cqw;
        flex: none;
      }
      .sch {
        padding: 5cqw 6.4cqw 4.4cqw;
        display: flex;
        flex-direction: column;
        height: 100%;
        box-sizing: border-box;
        text-align: center;
      }
      .sch::before {
        content: '';
        position: absolute;
        inset: 1.4cqw;
        border: 0.5cqw solid var(--amber);
        border-radius: 2.2cqw;
        pointer-events: none;
      }
      .sch::after {
        content: '';
        position: absolute;
        inset: 2.5cqw;
        border: 0.14cqw dashed #f2b200;
        border-radius: 1.5cqw;
        pointer-events: none;
      }
      .sch .top {
        align-items: center;
      }
      .seal {
        width: 9.5cqw;
        height: 9.5cqw;
        margin: 1.4cqw auto 0;
      }
      .sch .title {
        font-weight: 700;
        color: var(--ink);
        font-size: 4cqw;
        line-height: 1.1;
        margin-top: 0.3cqw;
      }
      .sch .given {
        font-size: 1.35cqw;
        color: var(--muted);
        margin-top: 1.6cqw;
      }
      .sch .name {
        font-weight: 700;
        color: var(--orange);
        font-size: 3.8cqw;
        line-height: 1.2;
        margin-top: 0.2cqw;
      }
      .sch .for {
        font-size: 1.4cqw;
        margin-top: 1.2cqw;
      }
      .sch .for b {
        color: var(--ink);
      }
      .sch .for.sub {
        margin-top: 0.4cqw;
        color: var(--muted);
      }
      .sch .bottom {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 2cqw;
        text-align: left;
      }
      .sch .verify {
        justify-content: flex-end;
      }
      .revoked {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) rotate(-14deg);
        border: 0.8cqw solid #c7420a;
        color: #c7420a;
        font-family: var(--display);
        font-weight: 700;
        font-size: 11cqw;
        letter-spacing: 0.08em;
        padding: 0.4cqw 3cqw;
        border-radius: 1.4cqw;
        opacity: 0.8;
        background: rgba(255, 255, 255, 0.55);
        pointer-events: none;
      }
      @media print {
        :host {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        /* the sheet IS the page, in physical units, so it always fits one page whatever the window was (a px size left a fraction
           of a pixel over the page and pushed the bottom row onto a second, clipped one) */
        .sheet {
          width: 297mm;
          height: 210mm;
          max-width: none;
          aspect-ratio: auto;
          overflow: hidden;
          box-shadow: none;
          break-inside: avoid;
          page-break-inside: avoid;
          break-after: avoid;
        }
        .sheet.a3 {
          width: 420mm;
          height: 297mm;
        }
        /* a slot is blank space on paper: no outline, no stripes, and no text at all (not even invisible text in the PDF) */
        .slot {
          outline: none;
          background: none;
        }
        .slot-label {
          display: none;
        }
      }
    `,
  ],
})
export class CertificateSheetComponent {
  readonly certificate = input.required<CertificateRecord>();
  readonly look = input.required<CertificateLook>();
  /** The origin the QR points at (the admin's own: `location.origin`). */
  readonly origin = input.required<string>();
  /** The paper it is printed on; only the print size follows it. */
  readonly paper = input<'A4' | 'A3'>('A4');

  readonly revoked = computed(() => !!this.certificate().revokedat);
  readonly words = computed(() => wordingFor(this.look(), this.certificate().scope, this.certificate().snapshot));
  readonly issued = computed(() => longDate(this.certificate().issuedat));
  readonly url = computed(() => verifyUrl(this.origin(), this.certificate().shortcode));
  readonly qr = computed(() => qrDrawing(this.url()));
}
