import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { APPROXIMATE_HINT, StudentAward, nameOrDash } from './awards';

/**
 * The awards of one learner as a plain table: a small badge with the level's order, the level, the curriculum (and, on the
 * report, the grade) and when it was earned. An approximate date reads "by <date>" with an "Approx." tag. Read-only.
 */
@Component({
  selector: 'app-awards-table',
  standalone: true,
  imports: [CommonModule, NzTableModule, NzTooltipModule],
  template: `
    <nz-table
      [nzData]="rows"
      nzSize="small"
      [nzFrontPagination]="false"
      [nzShowPagination]="false"
      data-testid="awards-table"
    >
      <thead>
        <tr>
          <th style="width: 64px">Badge</th>
          <th>Level</th>
          @if (showGrade) {
            <th>Grade</th>
          }
          <th>Curriculum</th>
          <th>Earned</th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows; track row.studentawardid) {
          <tr data-testid="award-row">
            <td>
              <svg class="badge" width="30" height="30" viewBox="0 0 32 32" role="img" [attr.aria-label]="'Level ' + (row.levelorder ?? 'unknown')">
                <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" />
                <text x="16" y="20.5" text-anchor="middle">{{ row.levelorder ?? '–' }}</text>
              </svg>
            </td>
            <td data-testid="award-level">{{ name(row.levelname) }}</td>
            @if (showGrade) {
              <td data-testid="award-grade">{{ name(row.gradename) }}</td>
            }
            <td data-testid="award-curriculum">{{ name(row.curriculumname) }}</td>
            <td data-testid="award-earned">
              @if (row.earnedat_approximate) {
                by {{ row.earnedat | date: 'd MMM y' }}
                <span
                  class="approx"
                  data-testid="award-approx"
                  nz-tooltip
                  [nzTooltipTitle]="hint"
                  tabindex="0"
                  [attr.aria-label]="'Approx. ' + hint"
                  >Approx.</span
                >
              } @else {
                {{ row.earnedat | date: 'd MMM y' }}
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
  styles: [
    `
      .badge polygon {
        fill: var(--color-action-tint, #e6efff);
        stroke: var(--color-action, #0b5fff);
        stroke-width: 2;
      }
      .badge text {
        fill: var(--color-ink, #1b1b1b);
        font: 700 13px var(--font-body, sans-serif);
      }
      .approx {
        margin-left: 6px;
        padding: 1px 8px;
        border-radius: 10px;
        background: var(--color-edge, #e5e5e5);
        color: var(--color-ink, #1b1b1b);
        font-size: 12px;
        cursor: help;
      }
    `,
  ],
})
export class AwardsTableComponent {
  @Input() rows: StudentAward[] = [];
  @Input() showGrade = false;
  readonly hint = APPROXIMATE_HINT;
  readonly name = nameOrDash;
}
