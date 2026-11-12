import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgxPermissionsModule } from 'ngx-permissions';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { Subject, switchMap, catchError, of, map } from 'rxjs';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { StandardService } from 'src/app/services/standard.service';
import {
  CREATE_CERTIFICATE_PERMISSIONS,
  CERTIFICATE_TIERS,
  Candidate,
  CertificateScope,
  CertificateTier,
  IssueSummary,
  MAX_REVOKE_REASON,
  NO_CERTIFICATES_MESSAGE,
  REVOKE_CERTIFICATE_PERMISSIONS,
  RecognitionSettings,
  STATUS_LABEL,
  failureText,
  issueAllLabel,
  issueSummary,
  offeredTiers,
  readyIds,
  revokeReasonToSend,
  shortDate,
  whyLines,
} from './certificate';
import { CertificateService, ScopeRequest } from './certificate.service';

interface CurriculumRow extends RecognitionSettings {
  curriculumid: string;
  curriculumname: string;
}
interface ScopeOption {
  id: string;
  label: string;
}
interface ClassOption {
  standardid: string;
  label: string;
}

const LOAD_FAILED = 'The learners could not be loaded. Try again in a moment.';

/**
 * The Certificates page: pick a curriculum, then a tier the curriculum gives certificates for (its Recognition setting), then the
 * level or grade (or the curriculum itself) and, if wanted, a class. The table lists who is ready, who is not and why (the learning
 * server's answer, relayed by central), and who already holds a certificate. Staff issue to one learner or to every ready one, view
 * an issued certificate (its print page) and revoke it with a reason; nothing is automatic. A failure to ask the learning server
 * (502) is one banner; the table already shown is kept.
 */
@Component({
  selector: 'app-certificates-page',
  standalone: true,
  imports: [FormsModule, RouterLink, NgxPermissionsModule, NzSelectModule, NzTableModule, NzModalModule],
  template: `
    <h1 class="page-title">Certificates</h1>
    <p class="help">Staff issue certificates. A learner is ready when every quiz in the level, grade or curriculum is passed at 80% or more and the learning server has marked each pass.</p>

    <div class="picks" data-testid="cert-picks">
      <label class="pick">
        <span>Curriculum</span>
        <nz-select [ngModel]="curriculumid()" (ngModelChange)="pickCurriculum($event)" nzPlaceHolder="Choose a curriculum" data-testid="pick-curriculum" nzShowSearch>
          @for (c of curricula(); track c.curriculumid) {
            <nz-option [nzLabel]="c.curriculumname" [nzValue]="c.curriculumid"></nz-option>
          }
        </nz-select>
      </label>
      @if (curriculum() && tiers().length > 0) {
        <label class="pick">
          <span>Give certificates for</span>
          <nz-select [ngModel]="scope()" (ngModelChange)="pickTier($event)" nzPlaceHolder="Choose a tier" data-testid="pick-tier">
            @for (t of tiers(); track t.scope) {
              <nz-option [nzLabel]="t.label" [nzValue]="t.scope"></nz-option>
            }
          </nz-select>
        </label>
      }
      @if (scope() && scope() !== 'curriculum') {
        <label class="pick">
          <span>{{ tier()?.label }}</span>
          <nz-select [ngModel]="scopeid()" (ngModelChange)="pickScope($event)" [nzPlaceHolder]="'Choose a ' + tier()?.noun" data-testid="pick-scope" nzShowSearch [nzLoading]="scopesLoading()">
            @for (s of scopeOptions(); track s.id) {
              <nz-option [nzLabel]="s.label" [nzValue]="s.id"></nz-option>
            }
          </nz-select>
        </label>
      }
      @if (scopeid()) {
        <label class="pick">
          <span>Class (optional)</span>
          <nz-select [ngModel]="standardid()" (ngModelChange)="pickClass($event)" nzAllowClear nzPlaceHolder="All classes" data-testid="pick-class" nzShowSearch>
            @for (k of classes(); track k.standardid) {
              <nz-option [nzLabel]="k.label" [nzValue]="k.standardid"></nz-option>
            }
          </nz-select>
        </label>
      }
    </div>

    @if (curriculumsFailed()) {
      <p class="error" role="alert" data-testid="cert-error">The curricula could not be loaded. Try again in a moment.</p>
    }
    @if (curriculum() && tiers().length === 0) {
      <p class="empty" data-testid="cert-no-tiers">{{ noCertificates }} <a routerLink="/curriculum/index">Curricula</a></p>
    }
    @if (error()) {
      <p class="error" role="alert" data-testid="cert-error">{{ error() }}</p>
    }

    @if (summary(); as s) {
      <div class="summary" role="status" data-testid="issue-summary">
        <strong data-testid="issue-headline">{{ s.headline }}</strong>
        @if (s.issued.length > 0) {
          <ul data-testid="issue-codes">
            @for (i of s.issued; track i.certificateid) {
              <li>{{ i.name }} — <span class="mono" data-testid="issue-code">{{ i.shortcode }}</span></li>
            }
          </ul>
        }
        @if (s.refusals.length > 0) {
          <ul class="refusals" data-testid="issue-refusals">
            @for (r of s.refusals; track $index) {
              <li data-testid="issue-refusal">{{ r }}</li>
            }
          </ul>
        }
        <button type="button" class="link" (click)="summary.set(null)">Dismiss</button>
      </div>
    }
    @if (notice()) {
      <div class="summary" role="status" data-testid="cert-notice">{{ notice() }}</div>
    }

    @if (scopeid()) {
      <div class="bar">
        <span class="count" data-testid="cert-count">{{ loading() ? 'Loading…' : rows().length + (rows().length === 1 ? ' learner' : ' learners') }}</span>
        <button *ngxPermissionsOnly="createPermissions" type="button" class="primary" data-testid="issue-all" [disabled]="ready().length === 0 || busy()" (click)="issue(ready())">{{ issueAllLabel(ready().length) }}</button>
      </div>
      <nz-table [nzData]="rows()" nzSize="small" [nzFrontPagination]="false" [nzShowPagination]="false" data-testid="cert-table">
        <thead>
          <tr>
            <th>Learner</th>
            <th>Status</th>
            <th>Why</th>
            <th><span class="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.student.studentid) {
            <tr data-testid="cert-row">
              <td data-testid="cert-learner">
                {{ row.student.name }}
                @if (row.student.classname) {
                  <div class="sub">{{ row.student.classname }}</div>
                }
              </td>
              <td>
                <span class="chip" [class]="row.status" data-testid="cert-status">{{ statusLabel[row.status] }}</span>
                @if (row.certificate) {
                  <div class="sub" data-testid="cert-issued-on">{{ date(row.certificate.issuedat) }} · <span class="mono">{{ row.certificate.shortcode }}</span></div>
                }
              </td>
              <td data-testid="cert-why">
                @for (line of why(row); track $index) {
                  <div [class.sub]="$index > 0 || row.status === 'ready' || row.status === 'issued'" data-testid="cert-why-line">{{ line }}</div>
                }
              </td>
              <td class="actions">
                @if (row.status === 'ready') {
                  <button *ngxPermissionsOnly="createPermissions" type="button" class="primary small" data-testid="issue-one" [disabled]="busy()" (click)="issue([row])">Issue</button>
                }
                @if (row.status === 'issued' && row.certificate) {
                  <a class="outline small" data-testid="view-one" [routerLink]="['/certificates', row.certificate.certificateid, 'print']">View</a>
                  <button *ngxPermissionsOnly="revokePermissions" type="button" class="outline small" data-testid="revoke-one" (click)="startRevoke(row)">Revoke</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && rows().length === 0 && !error()) {
        <p class="empty" data-testid="cert-none">No learners are enrolled on this curriculum{{ standardid() ? ' in that class' : '' }}.</p>
      }
    }

    <nz-modal
      [nzVisible]="revoking() !== null"
      nzTitle="Revoke certificate"
      nzOkText="Revoke certificate"
      nzOkDanger
      [nzOkDisabled]="!reasonToSend()"
      [nzOkLoading]="busy()"
      (nzOnOk)="confirmRevoke()"
      (nzOnCancel)="revoking.set(null)"
    >
      <ng-container *nzModalContent>
        @if (revoking(); as r) {
          <p data-testid="revoke-text">
            Revoke the certificate of <strong>{{ r.student.name }}</strong> ({{ r.certificate?.shortcode }})? The record is kept, the public check page will say it was withdrawn, and the learner can be issued a new one.
          </p>
        }
        <label for="revoke-reason">Reason (kept private, for staff only)</label>
        <textarea id="revoke-reason" rows="3" [maxlength]="maxReason" [ngModel]="reason()" (ngModelChange)="reason.set($event)" data-testid="revoke-reason"></textarea>
        <div class="sub" data-testid="revoke-count">{{ reason().length }} / {{ maxReason }}</div>
        @if (revokeError()) {
          <p class="error" role="alert" data-testid="revoke-error">{{ revokeError() }}</p>
        }
      </ng-container>
    </nz-modal>
  `,
  styles: [
    `
      .page-title {
        margin: 0 0 8px;
        font: 700 28px/36px var(--font-body);
        color: var(--color-ink);
      }
      .help {
        margin: 0 0 16px;
        font-size: 14px;
        color: var(--color-text-2, #555);
        max-width: 760px;
      }
      .picks {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 16px;
      }
      .pick {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 220px;
        font-size: 13px;
        color: var(--color-text-2, #555);
      }
      .pick nz-select {
        width: 100%;
      }
      .error {
        color: var(--color-danger, #b3261e);
        font-weight: 600;
      }
      .empty {
        margin: 12px 0;
      }
      .summary {
        background: #f3f5ff;
        border: 1px solid var(--color-edge, #e3e8ef);
        border-radius: 12px;
        padding: 12px 16px;
        margin-bottom: 16px;
      }
      .summary ul {
        margin: 6px 0 0;
        padding-left: 20px;
      }
      .refusals {
        color: #6b4b00;
      }
      .bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .sub {
        font-size: 12px;
        color: var(--color-text-2, #5a6b80);
      }
      .mono {
        font-family: 'Space Mono', ui-monospace, monospace;
      }
      .chip {
        display: inline-block;
        font-size: 12px;
        font-weight: 600;
        border-radius: 999px;
        padding: 2px 10px;
      }
      .chip.issued {
        background: #0f7a4f;
        color: #fff;
      }
      .chip.ready {
        background: #e3f7ee;
        color: #0f7a4f;
      }
      .chip.not_yet {
        background: #eef2f8;
        color: #3c4a5c;
      }
      .chip.cant_check {
        background: #fdece4;
        color: #a33608;
      }
      .actions {
        white-space: nowrap;
        text-align: right;
      }
      .primary,
      .outline,
      .link {
        font: 600 14px/1.5 var(--font-body, sans-serif);
        cursor: pointer;
        border-radius: 999px;
        text-decoration: none;
      }
      .primary {
        border: 0;
        background: var(--color-action, #0b5fff);
        color: #fff;
        padding: 6px 18px;
      }
      .primary[disabled] {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .outline {
        display: inline-block;
        border: 1.5px solid var(--color-edge, #c9d2de);
        background: #fff;
        color: var(--color-ink, #09101d);
        padding: 4px 14px;
        margin-left: 6px;
      }
      .small {
        font-size: 13px;
        padding-top: 3px;
        padding-bottom: 3px;
      }
      .link {
        border: 0;
        background: none;
        color: var(--color-action, #0b5fff);
        margin-top: 6px;
        padding: 0;
      }
      textarea {
        width: 100%;
        border: 1.5px solid #c9d2de;
        border-radius: 10px;
        padding: 8px 12px;
        font: 14px/1.5 var(--font-body, sans-serif);
      }
      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
      }
    `,
  ],
})
export class CertificatesPageComponent {
  private readonly curriculaApi = inject(CurriculumService);
  private readonly standards = inject(StandardService);
  private readonly api = inject(CertificateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly createPermissions = CREATE_CERTIFICATE_PERMISSIONS;
  readonly revokePermissions = REVOKE_CERTIFICATE_PERMISSIONS;
  readonly noCertificates = NO_CERTIFICATES_MESSAGE;
  readonly statusLabel = STATUS_LABEL;
  readonly maxReason = MAX_REVOKE_REASON;
  readonly issueAllLabel = issueAllLabel;
  readonly date = shortDate;

  readonly curricula = signal<CurriculumRow[]>([]);
  readonly curriculumsFailed = signal(false);
  readonly curriculumid = signal<string | null>(null);
  readonly scope = signal<CertificateScope | null>(null);
  readonly scopeid = signal<string | null>(null);
  readonly standardid = signal<string | null>(null);
  readonly scopeOptions = signal<ScopeOption[]>([]);
  readonly scopesLoading = signal(false);
  readonly classes = signal<ClassOption[]>([]);

  readonly rows = signal<Candidate[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly summary = signal<IssueSummary | null>(null);
  readonly notice = signal('');

  readonly revoking = signal<Candidate | null>(null);
  readonly reason = signal('');
  readonly revokeError = signal('');

  readonly curriculum = computed(() => this.curricula().find((c) => c.curriculumid === this.curriculumid()) ?? null);
  readonly tiers = computed(() => offeredTiers(this.curriculum()));
  readonly tier = computed<CertificateTier | undefined>(() => CERTIFICATE_TIERS.find((t) => t.scope === this.scope()));
  readonly ready = computed(() => this.rows().filter((r) => r.status === 'ready'));
  readonly reasonToSend = computed(() => revokeReasonToSend(this.reason()));

  private readonly load$ = new Subject<ScopeRequest & { standardid?: string }>();
  private readonly tree$ = new Subject<string>();

  constructor() {
    this.curriculaApi
      .getall({ pageindex: 1, pagesize: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => this.curricula.set(Array.isArray(res?.data?.data) ? res.data.data : []),
        error: () => this.curriculumsFailed.set(true),
      });
    this.standards
      .getAllStandards()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) =>
          this.classes.set(
            (Array.isArray(res?.data) ? res.data : []).map((k: any) => ({
              standardid: k.standardid,
              label: k.school?.schoolname ? `${k.standardname} (${k.school.schoolname})` : k.standardname,
            })),
          ),
        error: () => this.classes.set([]),
      });

    // The latest question wins: a slower answer to an earlier pick never replaces a later one.
    this.load$
      .pipe(
        switchMap((request) => {
          this.loading.set(true);
          return this.api.candidates(request).pipe(
            map((rows) => ({ rows })),
            catchError((err) => of({ failure: failureText(err, LOAD_FAILED) })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if ('rows' in result) {
          this.error.set('');
          this.rows.set(Array.isArray(result.rows) ? result.rows : []);
        } else {
          // one banner; whatever table is showing stays
          this.error.set(result.failure);
        }
      });

    this.tree$
      .pipe(
        switchMap((id) => {
          this.scopesLoading.set(true);
          return this.curriculaApi.curriculumtree(id).pipe(
            map((res: any) => ({ tree: res?.data?.[0] ?? null })),
            catchError(() => of({ tree: null })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ tree }) => {
        this.scopesLoading.set(false);
        this.scopeOptions.set(this.optionsFrom(tree));
      });
  }

  /** The grades (or the levels, each with its grade when there is more than one) of the chosen curriculum. */
  private optionsFrom(tree: any): ScopeOption[] {
    const grades: any[] = Array.isArray(tree?.grades) ? tree.grades : [];
    if (this.scope() === 'grade') return grades.map((g) => ({ id: g.gradeid, label: g.gradename }));
    return grades.flatMap((g) =>
      (Array.isArray(g.levels) ? g.levels : []).map((l: any) => ({ id: l.levelid, label: grades.length > 1 ? `${l.levelname} (${g.gradename})` : l.levelname })),
    );
  }

  why(row: Candidate): string[] {
    return whyLines(row, this.tier()?.noun ?? 'curriculum');
  }

  pickCurriculum(id: string | null): void {
    this.curriculumid.set(id);
    this.resetBelow('tier');
    const tiers = this.tiers();
    // one tier on offer: no need to pick it
    if (tiers.length === 1) this.pickTier(tiers[0].scope);
  }

  pickTier(scope: CertificateScope | null): void {
    this.scope.set(scope);
    this.resetBelow('scope');
    if (scope === 'curriculum') {
      this.scopeid.set(this.curriculumid());
      this.refresh();
    } else if (scope && this.curriculumid()) {
      this.tree$.next(this.curriculumid() as string);
    }
  }

  pickScope(id: string | null): void {
    this.scopeid.set(id);
    this.resetBelow('class');
    this.refresh();
  }

  pickClass(id: string | null): void {
    this.standardid.set(id ?? null);
    this.refresh();
  }

  private resetBelow(from: 'tier' | 'scope' | 'class'): void {
    if (from === 'tier') this.scope.set(null);
    if (from === 'tier' || from === 'scope') {
      this.scopeid.set(null);
      this.scopeOptions.set([]);
    }
    this.standardid.set(null);
    this.rows.set([]);
    this.error.set('');
    this.summary.set(null);
    this.notice.set('');
  }

  private request(): (ScopeRequest & { standardid?: string }) | null {
    const curriculumid = this.curriculumid();
    const scope = this.scope();
    const scopeid = this.scopeid();
    if (!curriculumid || !scope || !scopeid) return null;
    return { curriculumid, scope, scopeid, ...(this.standardid() ? { standardid: this.standardid() as string } : {}) };
  }

  refresh(): void {
    const request = this.request();
    if (request) this.load$.next(request);
  }

  private nameOf = (studentid: string): string => this.rows().find((r) => r.student.studentid === studentid)?.student.name ?? 'A learner';

  /** Issue to these learners (the ready ones on the row or on the button); central checks again with the learning server. */
  issue(candidates: readonly Candidate[]): void {
    const request = this.request();
    const studentids = readyIds(candidates);
    if (!request || studentids.length === 0 || this.busy()) return;
    this.busy.set(true);
    this.notice.set('');
    this.api.issue({ curriculumid: request.curriculumid, scope: request.scope, scopeid: request.scopeid, studentids }).subscribe({
      next: (answer) => {
        this.busy.set(false);
        this.error.set('');
        this.summary.set(issueSummary(answer, this.nameOf));
        this.refresh();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(failureText(err, 'The certificates could not be issued. Try again in a moment.'));
      },
    });
  }

  startRevoke(row: Candidate): void {
    this.reason.set('');
    this.revokeError.set('');
    this.revoking.set(row);
  }

  confirmRevoke(): void {
    const row = this.revoking();
    const reason = this.reasonToSend();
    if (!row?.certificate || !reason || this.busy()) return;
    this.busy.set(true);
    this.api.revoke(row.certificate.certificateid, reason).subscribe({
      next: () => {
        this.busy.set(false);
        this.revoking.set(null);
        this.summary.set(null);
        this.notice.set(`The certificate ${row.certificate?.shortcode} of ${row.student.name} was revoked.`);
        this.refresh();
      },
      error: (err) => {
        this.busy.set(false);
        this.revokeError.set(failureText(err, 'The certificate could not be revoked. Try again in a moment.'));
      },
    });
  }
}
