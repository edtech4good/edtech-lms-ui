import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { CHOOSE_ORGANISATION_NOTICE } from './owner-view';
import { OwnerViewService } from './owner-view.service';

/**
 * A "Create" control of a list. In the platform view (no organisation chosen) every create is refused, so the control is
 * disabled and says why; in an organisation it is the same link as before.
 */
@Component({
  selector: 'app-create-action',
  standalone: true,
  imports: [RouterLink, NzButtonModule, NzTooltipModule],
  template: `
    @if (owner.createBlocked()) {
      <span nz-tooltip [nzTooltipTitle]="notice" class="create-action-blocked" data-testid="create-blocked">
        <button nz-button nzType="primary" disabled type="button">{{ label() }}</button>
      </span>
    } @else {
      <a nz-button nzType="primary" [routerLink]="link()" (click)="activated.emit()">{{ label() }}</a>
    }
  `,
})
export class CreateActionComponent {
  protected readonly owner = inject(OwnerViewService);
  protected readonly notice = CHOOSE_ORGANISATION_NOTICE;
  readonly link = input.required<string | string[]>();
  readonly label = input('Create');
  /** For a page that stores state before it leaves for the create form. */
  readonly activated = output<void>();
}
