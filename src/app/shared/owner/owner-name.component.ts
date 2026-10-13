import { Component, inject, input } from '@angular/core';
import { OwnerViewService } from './owner-view.service';

/** The owning organisation's name in a list cell (the id when the organisation is unknown). */
@Component({
  selector: 'app-owner-name',
  standalone: true,
  template: `<span class="owner-name" data-testid="owner-name">{{ owner.label(id()) }}</span>`,
})
export class OwnerNameComponent {
  protected readonly owner = inject(OwnerViewService);
  readonly id = input<string | null | undefined>(null);
}
