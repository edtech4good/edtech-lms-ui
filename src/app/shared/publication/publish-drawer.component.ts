import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, output, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Subscription, lastValueFrom } from 'rxjs';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { clearListCaches } from 'src/app/services/list-cache';
import { PublicationPillComponent } from './publication-pill.component';
import { gatewayWords } from './publication-errors';
import { PublicationOverview, Refusal, pillOf, pushMessage, pushToast, refusalOf, viewOf } from './publication.model';

/** The curriculum the drawer is opened for. */
export interface PublishTarget {
  curriculumid: string;
  curriculumname: string;
}

/**
 * The publish drawer of a curriculum (design: docs/content-publishing-design.md, the w2 confirm step; plan:
 * docs/admin-publish-screen-plan.md, item 2 and 3).
 *
 * It reads the curriculum's publication overview and says what a publish would do: the total, the named lessons and
 * questions added, changed and removed, the rows other curricula also use, the rows that have moved to another curriculum,
 * the translation coverage. Publish sends the PUT; the drawer closes on the answer and a toast carries the API's push
 * sentence (a failed push is an error toast that stays: the publish stands).
 *
 * There is no drawn reference beyond w2; the frame is the translations panel's (class "org-drawer", 560 px, full width on a
 * phone). Every call it makes is made with FAILURES_SHOWN_BY_CALLER, so the error interceptor says nothing and each status
 * is worded here (`refusalOf`): a 400 beside the content with the API's words and the tables it names, a 409 with Reload,
 * a gone curriculum closes the drawer, an unreachable service is the drawer's error state with Try again.
 */
@Component({
  selector: 'app-publish-drawer',
  standalone: true,
  imports: [NzButtonModule, NzDrawerModule, PublicationPillComponent],
  templateUrl: './publish-drawer.component.html',
  styleUrl: './publish-drawer.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublishDrawerComponent implements OnDestroy {
  private readonly service = inject(CurriculumService);
  private readonly notification = inject(NzNotificationService);

  /** The curriculum was published (its id): the list reads its state again. */
  readonly published = output<string>();
  /** The curriculum is gone (a 404): the list reloads. */
  readonly missing = output<string>();

  readonly open = signal(false);
  readonly target = signal<PublishTarget | null>(null);
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly overview = signal<PublicationOverview | null>(null);
  readonly publishing = signal(false);
  /** Why the drawer cannot show or publish: the words of the error state (Try again). */
  readonly errorText = signal('');
  /** A refusal of the publish itself, said beside the content. */
  readonly refusal = signal<Refusal | null>(null);

  readonly pill = computed(() => {
    const o = this.overview();
    return o === null ? null : pillOf(o);
  });
  readonly view = computed(() => {
    const o = this.overview();
    return o === null ? null : viewOf(o);
  });
  readonly invalid = computed(() => {
    const r = this.refusal();
    return r?.kind === 'invalid' ? r : null;
  });

  /** The overview read in flight, if any: a read for an earlier curriculum must never answer for the one now shown. */
  private read: Subscription | null = null;

  show(target: PublishTarget): void {
    this.cancelRead();
    this.target.set(target);
    this.overview.set(null);
    this.refusal.set(null);
    this.open.set(true);
    this.load();
  }

  /** Reads the overview (again): the first read, Try again, and Reload after a 409. */
  load(): void {
    const target = this.target();
    if (target === null) return;
    this.cancelRead();
    this.state.set('loading');
    this.refusal.set(null);
    this.read = this.service.publication(target.curriculumid, true).subscribe({
      next: (overview) => {
        // Second guard, beside the cancel: an answer for any other curriculum than the one shown is dropped.
        if (overview.curriculumid !== this.target()?.curriculumid) return;
        this.overview.set(overview);
        this.state.set('ready');
      },
      error: (e: HttpErrorResponse) => {
        if (target.curriculumid !== this.target()?.curriculumid) return;
        const refusal = refusalOf(e.status, e.error);
        if (refusal.kind === 'missing') return this.gone(target);
        this.errorText.set(this.wordsFor(refusal, e));
        this.state.set('error');
      },
    });
  }

  requestClose(): void {
    if (this.publishing()) return;
    this.cancelRead();
    this.open.set(false);
  }

  ngOnDestroy(): void {
    this.cancelRead();
  }

  private cancelRead(): void {
    this.read?.unsubscribe();
    this.read = null;
  }

  async publish(): Promise<void> {
    const target = this.target();
    if (target === null || this.publishing() || this.state() !== 'ready') return;
    this.publishing.set(true);
    this.refusal.set(null);
    try {
      const answer = await lastValueFrom(this.service.publish(target.curriculumid));
      // The map keeps the tree, with each curriculum's state, in the session: what it holds is now old.
      clearListCaches();
      this.open.set(false);
      const toast = pushToast(answer.push);
      this.notification.create(
        toast.type,
        toast.type === 'error' ? `Published “${target.curriculumname}”, but the push failed` : 'Published',
        pushMessage(answer.push) || `“${target.curriculumname}” was published.`,
        { nzDuration: toast.duration }
      );
      this.published.emit(target.curriculumid);
    } catch (e) {
      this.refused(target, e as HttpErrorResponse);
    } finally {
      this.publishing.set(false);
    }
  }

  private refused(target: PublishTarget, error: HttpErrorResponse): void {
    const refusal = refusalOf(error.status, error.error);
    switch (refusal.kind) {
      case 'missing':
        this.gone(target);
        return;
      case 'gateway':
        // Nothing is known of what the service did: read the overview again before publishing again (Try again).
        this.errorText.set(this.wordsFor(refusal, error));
        this.state.set('error');
        return;
      default:
        this.refusal.set(refusal);
    }
  }

  /** The curriculum is gone: close, say so, and let the list reload. */
  private gone(target: PublishTarget): void {
    this.open.set(false);
    this.notification.error(`Couldn't publish “${target.curriculumname}”`, 'It no longer exists.');
    this.missing.emit(target.curriculumid);
  }

  /** The words of the drawer's error state: the API's own for a 502/503, the unreachable line for 0, else the refusal's. */
  private wordsFor(refusal: Refusal, error: HttpErrorResponse): string {
    return refusal.kind === 'gateway' ? gatewayWords(error) : refusal.kind === 'missing' ? 'Try again in a moment.' : refusal.message;
  }
}
