import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Pill } from './publication.model';

/**
 * The publication state of a curriculum as a pill (publication.model.ts, `pillOf`). One component for the list row, the
 * publish drawer's header and the map's tree node, so the three never word or colour a state differently. The colours are
 * the status pills' tokens: published (green), changed since publish (the plan colour), everything else slate; a problem
 * is the danger tint.
 */
@Component({
  selector: 'app-publication-pill',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="pill" [class]="pill().kind" [attr.title]="pill().title" data-testid="publication-pill" [attr.data-state]="pill().kind">{{ pill().text }}</span>`,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        padding: 0 10px;
        border-radius: 999px;
        font-size: 12px;
        line-height: 20px;
        font-weight: 600;
        white-space: nowrap;
        background: var(--color-slate-tint);
        color: var(--color-text-2-dark);
      }
      .published {
        background: var(--color-published-tint);
        color: var(--color-published-ink);
      }
      .changed {
        background: var(--color-plan-tint);
        color: var(--color-plan-ink);
      }
      .problem {
        background: var(--color-danger-tint);
        color: var(--color-danger);
      }
    `,
  ],
})
export class PublicationPillComponent {
  readonly pill = input.required<Pill>();
}
