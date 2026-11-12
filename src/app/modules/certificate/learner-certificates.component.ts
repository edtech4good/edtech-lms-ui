import { Component, Input, OnChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CertificateRecord, failureText, isRevoked, shortDate } from './certificate';
import { CertificateService } from './certificate.service';

/**
 * The "Certificates" section of the learner page: the learner's certificates, issued and revoked, newest first, each with a link
 * to its print page. Read-only; issuing and revoking are on the Certificates page. The page gates it on list_certificate.
 */
@Component({
  selector: 'app-learner-certificates',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="certs" data-testid="learner-certificates" aria-labelledby="certs-heading">
      <h3 id="certs-heading">Certificates</h3>
      @switch (state) {
        @case ('loading') {
          <p data-testid="certs-loading">Loading certificates…</p>
        }
        @case ('error') {
          <p class="error" role="alert" data-testid="certs-error">{{ errorMessage }}</p>
        }
        @case ('empty') {
          <p data-testid="certs-empty">No certificates yet.</p>
        }
        @default {
          <ul>
            @for (c of rows; track c.certificateid) {
              <li data-testid="cert-item">
                <span class="what" data-testid="cert-what">{{ c.snapshot.tierlabel }} {{ c.snapshot.scopename }} — {{ c.snapshot.curriculumname }}</span>
                <span class="sub">
                  <span data-testid="cert-state">{{ isRevoked(c) ? 'Revoked ' + date(c.revokedat) : 'Issued ' + date(c.issuedat) }}</span>
                  · <span class="mono">{{ c.shortcode }}</span>
                </span>
                <a [routerLink]="['/certificates', c.certificateid, 'print']" data-testid="cert-view">View</a>
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
  styles: [
    `
      .certs {
        margin-top: 16px;
      }
      h3 {
        margin: 0 0 8px;
        font-weight: 700;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 16px;
        align-items: baseline;
        padding: 6px 0;
        border-bottom: 1px solid var(--color-edge, #e3e8ef);
      }
      .what {
        font-weight: 600;
      }
      .sub {
        font-size: 13px;
        color: var(--color-text-2, #555);
      }
      .mono {
        font-family: 'Space Mono', ui-monospace, monospace;
      }
      .error {
        color: var(--color-danger, #b3261e);
      }
    `,
  ],
})
export class LearnerCertificatesComponent implements OnChanges {
  @Input({ required: true }) studentid = '';

  state: 'loading' | 'error' | 'empty' | 'ready' = 'loading';
  rows: CertificateRecord[] = [];
  errorMessage = '';
  readonly isRevoked = isRevoked;
  readonly date = shortDate;

  constructor(private readonly certificates: CertificateService) {}

  ngOnChanges(): void {
    if (!this.studentid) return;
    this.state = 'loading';
    this.certificates.forStudent(this.studentid).subscribe({
      next: (rows) => {
        // newest first, whatever order they came in
        this.rows = [...(Array.isArray(rows) ? rows : [])].sort((a, b) => new Date(b.issuedat).getTime() - new Date(a.issuedat).getTime());
        this.state = this.rows.length === 0 ? 'empty' : 'ready';
      },
      error: (err) => {
        this.rows = [];
        this.errorMessage = failureText(err, 'Certificates could not be loaded. Try again in a moment.');
        this.state = 'error';
      },
    });
  }
}
