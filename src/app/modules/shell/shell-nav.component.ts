import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  computed,
  effect,
  signal,
  untracked,
} from '@angular/core';
import { lmsuser } from '../../models/lmsuser.model';
import { Role } from '../../models/enums/role.enum';
import {
  SHELL_GROUPS,
  SHELL_HOME,
  ShellNavExpander,
  ShellNavGroup,
  ShellNavLink,
  isExpander,
} from './shell-nav.config';
import { ShellNavService } from './shell-nav.service';

const COLLAPSED_KEY = 'edtech-admin-nav-collapsed';
/** At or below this width the panel starts as the icon rail (design: README "Nav"). */
const RAIL_BREAKPOINT = 1024;

const ROLE_LABELS: Record<string, string> = {
  [Role.superadmin]: 'Superadmin',
  [Role.admin]: 'Admin',
  [Role.user]: 'User',
};

@Component({
  selector: 'app-shell-nav',
  standalone: false,
  templateUrl: './shell-nav.component.html',
  styleUrls: ['./shell-nav.component.less'],
})
export class ShellNavComponent {
  @Input() user: lmsuser | null = null;
  /** The account menu's "Sign out". The parent decides what signing out does. */
  @Output() signOut = new EventEmitter<void>();

  @ViewChild('list') private listRef?: ElementRef<HTMLElement>;
  @ViewChild('accountChip') private accountChipRef?: ElementRef<HTMLElement>;
  @ViewChild('accountMenu') private accountMenuRef?: ElementRef<HTMLElement>;

  readonly home = SHELL_HOME;
  readonly groups = SHELL_GROUPS;
  readonly isExpander = isExpander;

  readonly collapsed = signal<boolean>(this.initialCollapsed());
  readonly accountOpen = signal(false);
  /** Expanders the user (or a route) has opened. */
  private readonly opened = signal<ReadonlySet<string>>(new Set());
  readonly activeKey = computed(() => this.nav.active()?.link.key ?? null);

  constructor(
    readonly nav: ShellNavService,
    private readonly host: ElementRef<HTMLElement>,
  ) {
    // Opening a page under an expander opens that sub-list.
    effect(() => {
      const parent = this.nav.active()?.parent;
      if (parent) {
        untracked(() => this.setOpen(parent.key, true));
      }
    });
    // Keep the active item in view once the list has rendered it.
    effect(() => {
      this.nav.active();
      this.collapsed();
      setTimeout(() => this.keepActiveVisible(), 150);
    });
  }

  // ---- Account chip ------------------------------------------------------

  get displayName(): string {
    const u = this.user;
    const full = `${u?.firstname ?? ''} ${u?.lastname ?? ''}`.trim();
    return full || u?.lmsusername || 'Account';
  }

  get initials(): string {
    const u = this.user;
    const first = (u?.firstname ?? '').trim();
    const last = (u?.lastname ?? '').trim();
    const letters = first && last ? first[0] + last[0] : (first || u?.lmsusername || '?').slice(0, 2);
    return letters.toUpperCase();
  }

  get roleLabel(): string {
    return ROLE_LABELS[this.user?.lmsuserrole ?? ''] ?? 'Staff';
  }

  toggleAccount(): void {
    const open = !this.accountOpen();
    this.accountOpen.set(open);
    if (open) {
      setTimeout(() => this.accountMenuRef?.nativeElement.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    }
  }

  closeAccount(refocus = false): void {
    if (!this.accountOpen()) return;
    this.accountOpen.set(false);
    if (refocus) this.accountChipRef?.nativeElement.focus();
  }

  onAccountKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.closeAccount(true);
    }
  }

  onAccountFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && (event.currentTarget as HTMLElement).contains(next)) return;
    // relatedTarget is null when focus goes to the page body or another window.
    this.closeAccount();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.accountOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.closeAccount();
    }
  }

  doSignOut(): void {
    this.closeAccount();
    this.signOut.emit();
  }

  // ---- Collapse ----------------------------------------------------------

  toggleCollapsed(): void {
    this.setCollapsed(!this.collapsed());
  }

  private setCollapsed(value: boolean): void {
    this.collapsed.set(value);
    this.closeAccount();
    try {
      localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0');
    } catch {
      /* storage blocked (private window, site data cleared): the panel just won't remember */
    }
  }

  private initialCollapsed(): boolean {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      if (stored === '1') return true;
      if (stored === '0') return false;
    } catch {
      /* fall through to the viewport default */
    }
    return typeof window !== 'undefined' && window.innerWidth <= RAIL_BREAKPOINT;
  }

  // ---- Items ---------------------------------------------------------------

  isActive(link: ShellNavLink): boolean {
    return this.activeKey() === link.key;
  }

  /** True when the active item is one of this expander's children. */
  hasActiveChild(e: ShellNavExpander): boolean {
    return this.nav.active()?.parent?.key === e.key;
  }

  isOpen(e: ShellNavExpander): boolean {
    return this.opened().has(e.key);
  }

  onExpander(e: ShellNavExpander): void {
    if (this.collapsed()) {
      // The rail has no room for a sub-list: open the panel with this one expanded.
      this.setCollapsed(false);
      this.setOpen(e.key, true);
      return;
    }
    this.setOpen(e.key, !this.isOpen(e));
  }

  private setOpen(key: string, open: boolean): void {
    const next = new Set(this.opened());
    if (open) next.add(key);
    else next.delete(key);
    this.opened.set(next);
  }

  trackGroup = (_: number, g: ShellNavGroup) => g.key;

  private keepActiveVisible(): void {
    const list = this.listRef?.nativeElement;
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !current) return;
    const listBox = list.getBoundingClientRect();
    const box = current.getBoundingClientRect();
    if (box.bottom > listBox.bottom) list.scrollTop += box.bottom - listBox.bottom + 8;
    else if (box.top < listBox.top) list.scrollTop -= listBox.top - box.top + 8;
  }
}
