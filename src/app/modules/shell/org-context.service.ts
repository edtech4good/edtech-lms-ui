import { Injectable, inject, signal } from '@angular/core';
import { JwtHelperService } from '@auth0/angular-jwt';
import { TokenService } from '../../services/token.service';
import { PLATFORM_RETURN_NOTICE, shouldNotifyPlatformReturn } from './org-context';

/** Where a notice waits across the reload that follows a drop to the platform view. */
const NOTICE_KEY = 'edtech-org-notice';

/** What the access token says about organisations. */
export interface OrgClaims {
  lmsuserid: string;
  /** A platform account: Super Admin with no organisation of its own (true while acting as one, too). */
  isplatform: boolean;
  /** The organisation the token acts in: the account's own, or the one a platform account switched to. */
  organisationid: string | null;
}

/**
 * The organisation context of the signed-in staff account, read from the stored access
 * token's payload (never from a cached copy) whenever the stored token changes:
 * a sign-in, a refresh, an organisation switch. A refresh returns a platform account to
 * its own (platform) view, so when the organisation it was acting in is dropped that
 * way, one notice says so.
 */
@Injectable({ providedIn: 'root' })
export class OrgContextService {
  private readonly jwt = inject(JwtHelperService);
  private readonly tokens = inject(TokenService);

  readonly claims = signal<OrgClaims>(this.read());
  /** A notice for the shell to show once; cleared by `noticeShown()`. */
  readonly notice = signal<string | null>(null);

  /** Counts the times a platform account lost the organisation it was acting in (a refresh did it, not the person). */
  readonly platformReturns = signal(0);

  /**
   * Set by a switch the person made, so its own token change is not reported as a drop.
   * (Observable: a false drop would stash a notice that shows after the reload.)
   */
  private expected: string | null | undefined;

  constructor() {
    // A notice left by the reload that followed a drop: shown once.
    try {
      const waiting = sessionStorage.getItem(NOTICE_KEY);
      if (waiting) {
        sessionStorage.removeItem(NOTICE_KEY);
        this.notice.set(waiting);
      }
    } catch {
      /* storage blocked: no notice */
    }
    this.tokens.changed.subscribe(() => this.onTokenChanged());
  }

  /** Can this token be read at all (three parts, a JSON payload)? Used before a reissued token is stored. */
  isReadableToken(token: unknown): boolean {
    try {
      if (typeof token !== 'string' || token.split('.').length !== 3) return false;
      const payload = this.jwt.decodeToken(token) as Record<string, unknown> | null;
      return !!payload && typeof payload === 'object';
    } catch {
      return false;
    }
  }

  /** Read the claims from the stored token now (and keep them). */
  reread(): OrgClaims {
    const next = this.read();
    this.claims.set(next);
    return next;
  }

  /** The next token change is the switch the person asked for. */
  expectSwitchTo(organisationid: string | null): void {
    this.expected = organisationid;
  }

  noticeShown(): void {
    this.notice.set(null);
  }

  private onTokenChanged(): void {
    const before = this.claims();
    const after = this.reread();
    const expected = this.expected;
    this.expected = undefined;
    if (shouldNotifyPlatformReturn(before, after, expected)) {
      // The page was read in the acting context: the shell reloads it (or goes Home), and the
      // notice waits for the reload, since a toast would not survive it.
      try {
        sessionStorage.setItem(NOTICE_KEY, PLATFORM_RETURN_NOTICE);
      } catch {
        /* storage blocked: the page still reloads, without the notice */
      }
      this.platformReturns.update((n) => n + 1);
    }
  }

  private read(): OrgClaims {
    let payload: Record<string, unknown> | null = null;
    try {
      const token = this.tokens.gettoken();
      payload = token ? (this.jwt.decodeToken(token) as Record<string, unknown> | null) : null;
    } catch {
      payload = null;
    }
    return {
      lmsuserid: typeof payload?.['lmsuserid'] === 'string' ? (payload['lmsuserid'] as string) : '',
      isplatform: payload?.['isplatform'] === true,
      organisationid: typeof payload?.['organisationid'] === 'string' ? (payload['organisationid'] as string) : null,
    };
  }
}
