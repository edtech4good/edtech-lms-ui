import { Injectable, inject, signal } from '@angular/core';
import { JwtHelperService } from '@auth0/angular-jwt';
import { TokenService } from '../../services/token.service';
import { PLATFORM_RETURN_NOTICE } from './org-context';

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

  /** Set by a switch the person made, so its own token change is not reported as a drop. */
  private expected: string | null | undefined;

  constructor() {
    this.tokens.changed.subscribe(() => this.onTokenChanged());
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
    if (expected !== undefined) return;
    if (before.organisationid !== null && after.organisationid === null && after.isplatform) {
      this.notice.set(PLATFORM_RETURN_NOTICE);
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
