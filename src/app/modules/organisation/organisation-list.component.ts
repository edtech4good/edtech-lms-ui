import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NgxPermissionsService } from 'ngx-permissions';
import { EMPTY, Subject, catchError, debounceTime, lastValueFrom, switchMap, tap } from 'rxjs';
import { confirmDialog } from './confirm-dialog';
import { OrganisationDrawerComponent } from './organisation-drawer.component';
import { DEFAULT_TILE_COLOUR, NO_ACCESS_HEADING, NO_ACCESS_LINE, knownBranding, tileTextColour } from './organisation-form';
import { ApiErrorBody, Organisation, OrganisationWrite } from './organisation.model';
import { OrganisationService } from './organisation.service';

const SEARCH_DELAY_MS = 300;

/**
 * Organisations: every client on the platform (design o1). The list shows what the
 * API returns: no school, learner, staff or last-active figures, because it does not
 * return them yet. Paging and search are the API's; its order is by name and fixed,
 * so there is no sort.
 */
@Component({
  selector: 'app-organisation-list',
  standalone: true,
  imports: [
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    FormsModule,
    NgTemplateOutlet,
    NzButtonModule,
    NzTableModule,
    OrganisationDrawerComponent,
  ],
  templateUrl: './organisation-list.component.html',
  styleUrl: './organisation-list.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganisationListComponent {
  private readonly service = inject(OrganisationService);
  private readonly permissions = inject(NgxPermissionsService);
  private readonly modal = inject(NzModalService);
  private readonly notification = inject(NzNotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canCreate = !!this.permissions.getPermission('create_organisation');
  readonly canUpdate = !!this.permissions.getPermission('update_organisation');
  readonly canDelete = !!this.permissions.getPermission('delete_organisation');

  // ---- The list -------------------------------------------------------------
  readonly status = signal<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  readonly rows = signal<Organisation[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(20);
  /** What the search box says. */
  readonly search = signal('');
  /** What the list was last asked for. */
  readonly searched = signal('');
  readonly pageSizes = [20, 50, 100, 200];
  /** What the list says when the API refuses it (403), and no way to retry. */
  readonly noAccess = { heading: NO_ACCESS_HEADING, line: NO_ACCESS_LINE };

  /** "3 organisations", and the countries they cover when the page shows every one of them. */
  readonly summary = computed(() => {
    const total = this.total();
    const noun = `${total} ${total === 1 ? 'organisation' : 'organisations'}`;
    if (this.searched().trim()) {
      return `${noun} match “${this.searched().trim()}”`;
    }
    if (total > 0 && this.rows().length === total) {
      const countries = new Set(this.rows().flatMap((o) => o.countries.map((c) => c.countryid)));
      return `${noun} · ${countries.size} ${countries.size === 1 ? 'country' : 'countries'}`;
    }
    return noun;
  });

  private readonly load$ = new Subject<void>();
  private readonly typed$ = new Subject<string>();

  // ---- The drawer -----------------------------------------------------------
  readonly drawerOpen = signal(false);
  readonly editing = signal<Organisation | null>(null);
  /** Which control opened the drawer, so focus can go back to it. */
  private focusKey = '';

  constructor() {
    this.load$
      .pipe(
        tap(() => this.status.set('loading')),
        switchMap(() =>
          this.service
            .list({
              pageindex: this.pageIndex(),
              pagesize: this.pageSize(),
              organisationname: this.searched(),
            })
            .pipe(
              catchError((error: HttpErrorResponse) => {
                this.status.set(error.status === 403 ? 'forbidden' : 'error');
                return EMPTY;
              }),
            ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        this.rows.set(page.data);
        this.total.set(page.total);
        // A page past the end (the last row of the last page was deleted): go back one.
        if (page.data.length === 0 && page.total > 0 && this.pageIndex() > 1) {
          this.pageIndex.set(this.pageIndex() - 1);
          this.reload();
          return;
        }
        this.status.set('ready');
      });

    this.typed$
      .pipe(debounceTime(SEARCH_DELAY_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.searched.set(value);
        this.pageIndex.set(1);
        this.reload();
      });

    this.reload();
  }

  reload(): void {
    this.load$.next();
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.typed$.next(value);
  }

  clearSearch(): void {
    this.search.set('');
    this.searched.set('');
    this.pageIndex.set(1);
    this.reload();
  }

  onPageIndex(index: number): void {
    if (index === this.pageIndex()) return;
    this.pageIndex.set(index);
    this.reload();
  }

  onPageSize(size: number): void {
    if (size === this.pageSize()) return;
    this.pageSize.set(size);
    this.pageIndex.set(1);
    this.reload();
  }

  // ---- Presentation ---------------------------------------------------------
  tileColour(o: Organisation): string {
    return o.brandingconfig?.tilecolour ?? DEFAULT_TILE_COLOUR;
  }

  tileInk(o: Organisation): string {
    return tileTextColour(this.tileColour(o));
  }

  countries(o: Organisation): string {
    return o.countries.length ? o.countries.map((c) => c.countryname).join(', ') : '—';
  }

  // ---- Create and edit ------------------------------------------------------
  openNew(): void {
    this.focusKey = 'new';
    this.editing.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(o: Organisation): void {
    this.focusKey = `edit:${o.organisationid}`;
    this.editing.set(o);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.restoreFocus();
  }

  onSaved(event: { organisation: Organisation; created: boolean }): void {
    this.drawerOpen.set(false);
    this.notification.success(
      event.created ? 'Organisation created' : 'Organisation saved',
      event.organisation.organisationname,
      { nzDuration: 6000 },
    );
    if (event.created) {
      // Show it: it is listed by name, wherever that falls, so clear the search and start at page one.
      this.search.set('');
      this.searched.set('');
      this.pageIndex.set(1);
    }
    this.reload();
    this.restoreFocus();
  }

  /** Back to the control that opened the drawer, once the list has settled. */
  private restoreFocus(): void {
    const key = this.focusKey;
    setTimeout(() => {
      const target =
        document.querySelector<HTMLElement>(`[data-focus-key="${key}"]`) ??
        document.querySelector<HTMLElement>('[data-focus-key="new"]');
      target?.focus();
    }, 350);
  }

  // ---- Status and delete ----------------------------------------------------
  /** Suspend (false) or reactivate (true): the update route takes the whole record back. */
  setStatus(o: Organisation, active: boolean): void {
    const body: OrganisationWrite = {
      organisationname: o.organisationname,
      organisationshortname: o.organisationshortname,
      brandingconfig: knownBranding(o.brandingconfig),
      countryids: o.countries.map((c) => c.countryid),
      organisationstatus: active,
    };
    this.service.update(o.organisationid, body).subscribe({
      next: () => {
        this.notification.success(
          active ? 'Organisation reactivated' : 'Organisation suspended',
          o.organisationname,
          { nzDuration: 6000 },
        );
        this.reload();
      },
      error: (error: HttpErrorResponse) => this.failed(o, active ? 'reactivate' : 'suspend', error),
    });
  }

  /** Reactivating is one click; suspending ends staff sign-in, so it asks first. */
  toggleStatus(o: Organisation): void {
    if (!o.organisationstatus) {
      this.setStatus(o, true);
      return;
    }
    confirmDialog(this.modal, {
      nzTitle: `Suspend “${o.organisationname}”?`,
      nzContent: 'Its staff will be signed out and cannot sign in until it is reactivated.',
      nzOkText: 'Suspend organisation',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => this.setStatus(o, false),
    });
  }

  confirmDelete(o: Organisation): void {
    confirmDialog(this.modal, {
      nzTitle: `Delete “${o.organisationname}”?`,
      nzContent: `This removes the organisation from the list. Its code, ${o.organisationcode}, can't be used again. This can't be undone.`,
      nzOkText: 'Delete organisation',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () =>
        lastValueFrom(this.service.delete(o.organisationid)).then(
          () => {
            this.notification.success('Organisation deleted', o.organisationname, { nzDuration: 6000 });
            this.reload();
          },
          (error: HttpErrorResponse) => this.failed(o, 'delete', error),
        ),
    });
  }

  /**
   * An action on a row did not work. A 429, a 500 or no connection has already been
   * toasted by the error interceptor, and so was a 400 until the update request was
   * marked to show its field errors inline (a row action has no fields to show them on).
   * Everything else would otherwise be silent. A 409 carries the API's own words for
   * what is in the way ("This organisation still has staff users." / "Move or remove
   * them first, then try again."), written for people, so they are shown as they are.
   */
  private failed(o: Organisation, action: string, error: HttpErrorResponse): void {
    const title = `Couldn't ${action} ${o.organisationname}`;
    if ([0, 429, 500].includes(error.status)) {
      return;
    }
    if (error.status === 404) {
      this.notification.error(title, 'It no longer exists.');
      this.reload();
    } else if (error.status === 403) {
      this.notification.error(NO_ACCESS_HEADING, NO_ACCESS_LINE);
    } else if (error.status === 409) {
      const body = (error.error ?? {}) as ApiErrorBody;
      const said = [body.errormessage, body.hint].filter((t) => typeof t === 'string' && t.trim()).join(' ');
      this.notification.error(title, said || 'Try again in a moment.');
    } else {
      this.notification.error(title, 'Try again in a moment.');
    }
  }
}
