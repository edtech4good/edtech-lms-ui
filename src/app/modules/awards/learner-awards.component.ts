import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { ReportService } from 'src/app/services/report.service';
import { EMPTY_MESSAGE, ERROR_MESSAGE, StudentAward, awardsRequest, awardsSummary, newestFirst } from './awards';
import { AwardsTableComponent } from './awards-table.component';

/**
 * The "Awards" section of the learner page: what the learner has earned, newest first. Read-only; staff cannot grant or remove
 * an award. The page shows it only to a user who may see the level-progress report (the same permission the API asks for).
 * The learner is one of the caller's own, so central's offline route answers.
 */
@Component({
  selector: 'app-learner-awards',
  standalone: true,
  imports: [CommonModule, AwardsTableComponent],
  template: `
    <section class="awards" data-testid="learner-awards" aria-labelledby="awards-heading">
      <div class="head">
        <h3 id="awards-heading">Awards</h3>
        @if (state === 'ready') {
          <small data-testid="awards-summary">{{ summary }}</small>
        }
      </div>
      @switch (state) {
        @case ('loading') {
          <p class="msg" data-testid="awards-loading">Loading awards…</p>
        }
        @case ('error') {
          <p class="msg error" role="alert" data-testid="awards-error">{{ errorMessage }}</p>
        }
        @case ('empty') {
          <p class="msg" data-testid="awards-empty">{{ emptyMessage }}</p>
        }
        @default {
          <app-awards-table [rows]="rows"></app-awards-table>
          <p class="note">Awards are earned automatically and are never removed. "Approx." means the exact date was not recorded.</p>
        }
      }
    </section>
  `,
  styles: [
    `
      .awards {
        margin-top: 16px;
      }
      .head {
        display: flex;
        align-items: baseline;
        gap: 12px;
        margin-bottom: 8px;
      }
      h3 {
        margin: 0;
        font-weight: 700;
      }
      .msg {
        margin: 8px 0;
      }
      .error {
        color: var(--color-danger, #b3261e);
      }
      .note {
        margin: 8px 0 0;
        font-size: 13px;
        color: var(--color-text-2, #555);
      }
    `,
  ],
})
export class LearnerAwardsComponent implements OnChanges {
  @Input({ required: true }) studentid = '';

  state: 'loading' | 'error' | 'empty' | 'ready' = 'loading';
  rows: StudentAward[] = [];
  summary = '';
  readonly emptyMessage = EMPTY_MESSAGE;
  readonly errorMessage = ERROR_MESSAGE;

  constructor(private readonly reports: ReportService) {}

  ngOnChanges(): void {
    if (!this.studentid) return;
    this.state = 'loading';
    this.reports.getStudentAwards(awardsRequest(this.studentid)).subscribe({
      next: (res: any) => {
        const rows: StudentAward[] = Array.isArray(res?.data?.data) ? res.data.data : [];
        this.rows = newestFirst(rows);
        const approximate = this.rows.filter((r) => r.earnedat_approximate).length;
        this.summary = awardsSummary(Number(res?.data?.total ?? this.rows.length), approximate);
        this.state = this.rows.length === 0 ? 'empty' : 'ready';
      },
      error: () => {
        this.rows = [];
        this.state = 'error';
      },
    });
  }
}
