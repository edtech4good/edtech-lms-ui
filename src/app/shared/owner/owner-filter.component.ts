import { Component, OnInit, inject, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ALL_ORGANISATIONS_LABEL } from './owner-view';
import { OwnerViewService } from './owner-view.service';

/**
 * The filter at the top of an owned list in the platform view: one organisation, or all of them (the default). Hidden when
 * acting in an organisation. `changed` carries the organisation id, or `null` for all.
 */
@Component({
  selector: 'app-owner-filter',
  standalone: true,
  imports: [FormsModule, NzSelectModule],
  styles: [
    `
      .owner-filter {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }
    `,
  ],
  template: `
    @if (owner.active()) {
      <div class="owner-filter" data-testid="owner-filter">
        <label for="owner-filter-select">Organisation</label>
        <nz-select
          nzId="owner-filter-select"
          style="min-width: 240px"
          nzSize="small"
          nzShowSearch
          [ngModel]="selected()"
          (ngModelChange)="pick($event)"
        >
          <nz-option [nzValue]="''" [nzLabel]="allLabel"></nz-option>
          @for (o of owner.organisations(); track o.organisationid) {
            <nz-option [nzValue]="o.organisationid" [nzLabel]="o.organisationname"></nz-option>
          }
        </nz-select>
      </div>
    }
  `,
})
export class OwnerFilterComponent implements OnInit {
  protected readonly owner = inject(OwnerViewService);
  protected readonly allLabel = ALL_ORGANISATIONS_LABEL;
  /** The organisation the list is already narrowed to (a filter restored from the address). */
  readonly value = input<string | null>(null);
  protected readonly selected = linkedSignal(() => this.value() ?? '');
  readonly changed = output<string | null>();

  ngOnInit(): void {
    this.owner.refresh();
  }

  pick(value: string | null): void {
    this.selected.set(value ?? '');
    this.changed.emit(value ? value : null);
  }
}
