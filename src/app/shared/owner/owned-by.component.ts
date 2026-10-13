import { Component, OnInit, inject, input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { OwnerViewService } from './owner-view.service';

/** "Owned by <organisation>" in the header of a record opened from the platform view; nothing in an organisation. */
@Component({
  selector: 'app-owned-by',
  standalone: true,
  imports: [NzTagModule],
  template: `
    @if (owner.active()) {
      <nz-tag class="owned-by" data-testid="owned-by">Owned by {{ owner.label(id()) }}</nz-tag>
    }
  `,
})
export class OwnedByComponent implements OnInit {
  protected readonly owner = inject(OwnerViewService);
  readonly id = input<string | null | undefined>(null);

  ngOnInit(): void {
    // A record page has no list above it that loads the organisations' names.
    this.owner.refresh();
  }
}
