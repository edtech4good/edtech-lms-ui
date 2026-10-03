import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostListener, Input, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgxPermissionsService } from 'ngx-permissions';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { DEFAULT_TILE_COLOUR, tileTextColour } from '../organisation/organisation-form';
import { Organisation } from '../organisation/organisation.model';
import { OrganisationService } from '../organisation/organisation.service';
import { pageMakesSenseInAnyContext } from './org-context';
import { OrgContextService } from './org-context.service';
import { ShellNavService } from './shell-nav.service';
import { Router } from '@angular/router';

const PLATFORM_INK = '#1E293B';
/** The list is searchable once it is longer than a handful. */
const SEARCH_FROM = 6;

/** What the chip shows. */
interface Shown {
  name: string;
  /** The tile's letters (the organisation's short name); empty for the platform tile (a globe). */
  tile: string;
  colour: string;
  ink: string;
  sub: string;
}

const KIND: Record<string, string> = { company: 'Company', schoolnetwork: 'School network' };

/**
 * The organisation chip at the top of the nav, and for platform accounts the switcher it
 * opens (design: AdminNav.dc.html, "Admin Playful v2" artboards 02 and 03). The chip says
 * which organisation the session acts in, from the access token's claims; the switcher
 * asks the API to reissue the token for another one (or for none: the platform view).
 */
@Component({
  selector: 'app-org-switcher',
  standalone: false,
  templateUrl: './org-switcher.component.html',
  styleUrls: ['./org-switcher.component.less'],
})
export class OrgSwitcherComponent {
  @Input() collapsed = false;

  private readonly context = inject(OrgContextService);
  private readonly auth = inject(AuthService);
  private readonly organisations = inject(OrganisationService);
  private readonly users = inject(UserService);
  private readonly permissions = inject(NgxPermissionsService);
  private readonly notification = inject(NzNotificationService);
  private readonly router = inject(Router);
  private readonly nav = inject(ShellNavService);
  private readonly host = inject(ElementRef<HTMLElement>);

  @ViewChild('chip') private chipRef?: ElementRef<HTMLElement>;
  @ViewChild('menu') private menuRef?: ElementRef<HTMLElement>;

  readonly claims = this.context.claims;
  /** A platform account may switch; anyone else just sees where they work. */
  readonly canSwitch = computed(() => this.claims().isplatform);
  readonly acting = computed(() => this.claims().isplatform && this.claims().organisationid !== null);

  /** The organisation the token acts in (own or switched to), once looked up. */
  private readonly currentOrg = signal<Organisation | null>(null);
  /** A member's organisation name, when the account may read its own record. */
  private readonly memberOrgName = signal<string | null>(null);

  readonly shown = computed<Shown>(() => {
    const c = this.claims();
    if (c.isplatform && c.organisationid === null) {
      return { name: 'All organisations', tile: '', colour: PLATFORM_INK, ink: '#FFFFFF', sub: 'Platform view' };
    }
    const o = this.currentOrg();
    if (o && o.organisationid === c.organisationid) {
      const colour = o.brandingconfig?.tilecolour ?? DEFAULT_TILE_COLOUR;
      return {
        name: o.organisationname,
        tile: o.organisationshortname,
        colour,
        ink: tileTextColour(colour),
        sub: KIND[o.organisationpreset] ?? 'Organisation',
      };
    }
    const name = this.memberOrgName() ?? (this.acting() ? 'Organisation' : 'Your organisation');
    return { name, tile: initialsOf(name), colour: DEFAULT_TILE_COLOUR, ink: tileTextColour(DEFAULT_TILE_COLOUR), sub: 'Organisation' };
  });

  // ---- The menu -----------------------------------------------------------
  readonly open = signal(false);
  readonly orgs = signal<Organisation[]>([]);
  readonly listState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly query = signal('');
  readonly busy = signal(false);
  /** The one message a refused switch leaves in the menu. */
  readonly message = signal<string | null>(null);

  readonly searchable = computed(() => this.orgs().length >= SEARCH_FROM);
  readonly visibleOrgs = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.orgs().filter((o) => o.organisationname.toLowerCase().includes(q)) : this.orgs();
  });
  /** "All organisations" matches the words in it, so a search for them still finds it. */
  readonly showAll = computed(() => {
    const q = this.query().trim().toLowerCase();
    return !q || 'all organisations platform view'.includes(q);
  });

  constructor() {
    // Look up the organisation behind the chip whenever the token's organisation changes.
    effect(() => {
      const c = this.claims();
      untracked(() => this.lookUp(c.organisationid, c.isplatform, c.lmsuserid));
    });
    // The refresh that returns a platform account to its own view says so, once.
    effect(() => {
      const text = this.context.notice();
      if (text) {
        untracked(() => {
          this.notification.info(text, '');
          this.context.noticeShown();
        });
      }
    });
  }

  private lookUp(organisationid: string | null, isplatform: boolean, lmsuserid: string): void {
    this.currentOrg.set(null);
    this.memberOrgName.set(null);
    if (organisationid === null) return;
    if (isplatform) {
      this.organisations
        .get(organisationid)
        .pipe(first())
        .subscribe({ next: (o) => this.currentOrg.set(o), error: () => undefined });
    } else if (lmsuserid && this.permissions.getPermission('view_user')) {
      // An account that may read staff can read its own record, which names its organisation.
      this.users
        .get(lmsuserid)
        .pipe(first())
        .subscribe({
          next: (r: any) => this.memberOrgName.set(r?.data?.user?.organisation?.organisationname ?? null),
          error: () => undefined,
        });
    }
  }

  // ---- Open and close -------------------------------------------------------
  toggle(): void {
    if (!this.canSwitch()) return;
    this.open() ? this.close(true) : this.openMenu();
  }

  private openMenu(): void {
    this.open.set(true);
    this.message.set(null);
    this.query.set('');
    this.loadList();
  }

  close(refocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (refocus) this.chipRef?.nativeElement.focus();
  }

  /** `quiet`: refresh the rows in place (no "Loading" state), so the row in focus is not torn down. */
  loadList(quiet = false): void {
    if (!quiet) this.listState.set('loading');
    this.users
      .liveOrganisations()
      .pipe(first())
      .subscribe({
        next: (all) => {
          this.orgs.set(all);
          this.listState.set('ready');
          if (!quiet) setTimeout(() => this.focusStart());
        },
        // A 403 here is already said by this menu; anything else the interceptor toasts or this line says.
        error: () => this.listState.set('error'),
      });
  }

  private focusStart(): void {
    const menu = this.menuRef?.nativeElement;
    if (!menu) return;
    const search = menu.querySelector<HTMLElement>('input[type="search"]');
    (search ?? menu.querySelector<HTMLElement>('[aria-checked="true"]') ?? this.items()[0])?.focus();
  }

  private items(): HTMLElement[] {
    return Array.from(this.menuRef?.nativeElement.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);
  }

  onQuery(value: string): void {
    this.query.set(value);
  }

  onKeydown(event: KeyboardEvent): void {
    const key = event.key;
    if (key === 'Escape') {
      event.stopPropagation();
      this.close(true);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return;
    const nodes: HTMLElement[] = [];
    const search = this.menuRef?.nativeElement.querySelector<HTMLElement>('input[type="search"]');
    if (search) nodes.push(search);
    nodes.push(...this.items());
    if (nodes.length === 0) return;
    event.preventDefault();
    const at = nodes.indexOf(document.activeElement as HTMLElement);
    let next = at;
    if (key === 'ArrowDown') next = at < 0 ? 0 : Math.min(at + 1, nodes.length - 1);
    if (key === 'ArrowUp') next = at < 0 ? nodes.length - 1 : Math.max(at - 1, 0);
    if (key === 'Home') next = 0;
    if (key === 'End') next = nodes.length - 1;
    nodes[next].focus();
  }

  onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && (event.currentTarget as HTMLElement).contains(next)) return;
    this.close();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  // ---- Choosing --------------------------------------------------------------
  isCurrent(organisationid: string | null): boolean {
    return this.claims().organisationid === organisationid;
  }

  choose(organisationid: string | null, suspended = false): void {
    if (this.busy() || suspended) return;
    if (this.isCurrent(organisationid)) {
      this.close(true);
      return;
    }
    this.busy.set(true);
    this.message.set(null);
    this.auth
      .switchOrganisation(organisationid)
      .pipe(first())
      .subscribe({
        next: (response) => {
          this.busy.set(false);
          this.context.expectSwitchTo(organisationid);
          // Stores both tokens, re-arms the refresh timer and reloads the permissions.
          this.auth.setlogin(response.data.accessToken, response.data.refreshToken);
          this.close();
          this.reloadForNewContext();
        },
        error: (error: HttpErrorResponse) => {
          this.busy.set(false);
          this.message.set(switchRefusal(error));
          if (error.status === 404) this.loadList(true);
        },
      });
  }

  /**
   * Everything on screen was read in the old context: reload it. A page about one
   * record (an edit or view page) may not exist in the new context, so that goes Home.
   */
  private reloadForNewContext(): void {
    if (!pageMakesSenseInAnyContext(this.router.url)) {
      this.router.navigateByUrl(this.nav.homeRoute).then(() => window.location.reload());
    } else {
      window.location.reload();
    }
  }

  kindOf(o: Organisation): string {
    return (KIND[o.organisationpreset] ?? 'Organisation') + (o.organisationstatus ? '' : ' · suspended');
  }

  tileOf(o: Organisation): { background: string; color: string } {
    const colour = o.brandingconfig?.tilecolour ?? DEFAULT_TILE_COLOUR;
    return { background: colour, color: tileTextColour(colour) };
  }
}

/**
 * What a refused switch says in the menu. Statuses the error interceptor already toasts
 * (429, 500, no connection) say nothing here: one message, never two.
 */
export function switchRefusal(error: HttpErrorResponse): string | null {
  if ([0, 429, 500].includes(error.status)) return null;
  if (error.status === 403) return 'Only platform staff can switch organisation.';
  if (error.status === 404) return "That organisation isn't available. It may have been suspended or deleted.";
  return "Couldn't switch organisation. Try again.";
}

function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('');
  return letters.slice(0, 3).toUpperCase();
}
