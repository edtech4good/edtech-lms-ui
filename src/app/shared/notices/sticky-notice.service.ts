import { Injectable, TemplateRef } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { filter } from 'rxjs/operators';
import type { PushOutcome } from 'src/app/shared/publication/publication.model';

/** The key of the notice a refused sync leaves: pressing a refused sync twice shows one notice. */
export const SYNC_REFUSED_NOTICE_KEY = 'sync-refused';

/** The key of the warning a failed push to the learning server leaves. A second one replaces the first. */
export const PUSH_FAILED_NOTICE_KEY = 'push-failed';

/** The title of the warning a failed push leaves: the save itself went through. */
export const PUSH_FAILED_TITLE = 'Saved';

/**
 * Notices that stay until they are closed, and that go when the person leaves the page they are about.
 *
 * A notice that stays sits top right, over the page's main buttons, and ng-zorro keeps it across navigation, so on the
 * next screen it hid Create and Sync Content. Every notice made here is closed when the route changes (one listener, by
 * key), so no screen has to remember to. Ask for the service on a screen that makes such a notice: it is created, and starts
 * listening, the first time it is injected.
 */
@Injectable({ providedIn: 'root' })
export class StickyNoticeService {
  private readonly keys = new Set<string>();

  constructor(
    private readonly notification: NzNotificationService,
    router: Router,
  ) {
    router.events.pipe(filter((event) => event instanceof NavigationStart)).subscribe(() => this.closeAll());
  }

  /** Shows a notice that stays until it is closed or the route changes. The same key shows one notice, not two. */
  show(type: 'error' | 'warning' | 'info', title: string, content: string | TemplateRef<any>, key: string, data?: object): void {
    this.keys.add(key);
    this.notification.create(type, title, content, { nzDuration: 0, nzKey: key, ...(data ? { nzData: data } : {}) });
  }

  /**
   * The warning for a save whose push to the learning server failed: central's own sentence, kept until it is closed.
   * Returns whether it was shown (false when the push did not fail, so the caller shows its usual success).
   */
  pushFailed(push: PushOutcome | null | undefined): boolean {
    if (push?.status !== 'failed') return false;
    const said = typeof push.message === 'string' ? push.message.trim() : '';
    this.show(
      'warning',
      PUSH_FAILED_TITLE,
      said || 'Saved, but the learning server did not answer. Run Sync Content on the Curricula screen to send it again.',
      PUSH_FAILED_NOTICE_KEY,
    );
    return true;
  }

  /** Closes every notice made here. Called on every route change. */
  closeAll(): void {
    for (const key of this.keys) this.notification.remove(key);
    this.keys.clear();
  }
}

export { pushOf } from './notice-rules';
