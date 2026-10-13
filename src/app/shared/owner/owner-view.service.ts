import { Injectable, computed, inject, signal } from '@angular/core';
import { first } from 'rxjs/operators';
import { Organisation } from '../../modules/organisation/organisation.model';
import { OrgContextService } from '../../modules/shell/org-context.service';
import { UserService } from '../../services/user.service';
import { ownerColumnVisible, ownerLabel } from './owner-view';

/**
 * The platform view of an owned list: which organisation owns each row. `active()` is true only for a platform account that
 * is not acting in an organisation (when it acts, or for any other account, every list is the organisation's own and shows
 * no owner). The names come from the same organisation list the switcher loads.
 */
@Injectable({ providedIn: 'root' })
export class OwnerViewService {
  private readonly context = inject(OrgContextService);
  private readonly users = inject(UserService);

  readonly active = computed(() => ownerColumnVisible(this.context.claims()));
  /** Create controls are disabled in the same view: every create is made as an organisation. */
  readonly createBlocked = this.active;

  readonly organisations = signal<Organisation[]>([]);
  readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly names = computed(() => new Map(this.organisations().map((o) => [o.organisationid, o.organisationname] as const)));

  /** Load the organisations (platform view only); a list page asks again each time it opens, so a new organisation shows. */
  refresh(): void {
    if (!this.active() || this.state() === 'loading') return;
    this.state.set('loading');
    this.users
      .liveOrganisations()
      .pipe(first())
      .subscribe({
        next: (all) => {
          this.organisations.set(all);
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }

  /** What to write for an owner id; empty while the names are still loading, so an id never flashes. */
  label(id: string | null | undefined): string {
    if (this.state() === 'loading' || this.state() === 'idle') {
      return id === null || id === undefined || id === '' ? ownerLabel(id, this.names()) : '';
    }
    return ownerLabel(id, this.names());
  }
}
