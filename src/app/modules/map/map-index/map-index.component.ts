import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzFormatEmitEvent, NzTreeNode } from 'ng-zorro-antd/tree';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { UtilService } from 'src/app/services/util.service';
import {
  CoverageChip,
  TRANSLATIONS_TOAST_KEY,
  curriculumChips,
  lessonChips,
  translationErrorMessage,
} from 'src/app/shared/translations/translations.model';
import { TranslationsService } from 'src/app/shared/translations/translations.service';

@Component({
    selector: 'app-map-index',
    templateUrl: './map-index.component.html',
    styleUrls: ['./map-index.component.less'],
    standalone: false
})
export class MapIndexComponent implements OnInit {
  dataloading = false
  nodes: Array<any> = [];
  /**
   * Translation counts on the tree. Off until asked for: each curriculum's counts come from its publication overview,
   * which reads the organisation's content, so they are fetched when the switch is turned on, one curriculum at a time.
   */
  showCounts = false;
  countsState: 'idle' | 'loading' | 'ready' = 'idle';
  /** True once an overview came back and the organisation has translations in at least one language. */
  hasTranslations = false;
  curriculumChipsById = new Map<string, CoverageChip[]>();
  lessonChipsById = new Map<string, CoverageChip[]>();

  constructor(
    private cts: CurriculumService,
    private router: Router,
    private readonly _utilService: UtilService,
    private readonly translations: TranslationsService,
    private readonly notification: NzNotificationService,
    private readonly changes: ChangeDetectorRef
  ) {}

  async setCounts(on: boolean): Promise<void> {
    this.showCounts = on;
    if (!on || this.countsState !== 'idle') return;
    this.countsState = 'loading';
    this.hasTranslations = false;
    this.curriculumChipsById = new Map();
    this.lessonChipsById = new Map();
    for (const node of this.nodes) {
      const curriculumid: string | undefined = node?.data?.curriculumid;
      if (!curriculumid) continue;
      try {
        const coverage = await this.translations.coverage(curriculumid).toPromise();
        if (coverage && Object.keys(coverage.languages).length > 0) {
          this.hasTranslations = true;
          this.curriculumChipsById.set(curriculumid, curriculumChips(coverage));
          for (const child of this.lessonIds(node)) this.lessonChipsById.set(child, lessonChips(coverage, child));
        }
      } catch (e) {
        const error = e as HttpErrorResponse;
        this.notification.create('error', 'Error', translationErrorMessage(error.status, error.error), {
          nzKey: TRANSLATIONS_TOAST_KEY,
        });
        this.countsState = 'idle';
        this.showCounts = false;
        this.changes.markForCheck();
        return;
      }
    }
    this.countsState = 'ready';
    this.changes.markForCheck();
  }

  /** The lesson ids under a curriculum node of the tree. */
  private lessonIds(node: any): string[] {
    const out: string[] = [];
    const walk = (n: any) => {
      if (n?.data?.type === 'LESSON' && n.data.lessonid) out.push(n.data.lessonid);
      for (const c of n?.children ?? []) walk(c);
    };
    walk(node);
    return out;
  }

  reroute = (event: NzFormatEmitEvent) => {
    if (event.node?.origin?.data?.type) {
      sessionStorage.setItem('JqGJMqfgE9HEU6hC', JSON.stringify(this.nodes));
      switch (event.node?.origin.data.type) {
        case 'QUIZ':
          this.router.navigate([
            `lesson/quiz/${event.node?.origin.data.lessonid}`,
          ]);
          break;
        case 'CURRICULUM':
          this.router.navigate([
            `curriculum/update/${event.node?.origin.data.curriculumid}`,
          ]);
          break;
        case 'GRADE':
          this.router.navigate([
            `grade/update/${event.node?.origin.data.gradeid}`,
          ]);
          break;
        case 'LEVEL':
          this.router.navigate([
            `level/update/${event.node?.origin.data.levelid}`,
          ]);
          break;
        case 'LESSON':
          this.router.navigate([
            `lesson/update/${event.node?.origin.data.lessonid}`,
          ]);
          break;
        case 'QUIZQUESTION':
          this.router.navigate([
            `lesson/quiz/question/${event.node?.origin.data.lessonquizid}`,
          ]);
          break;
        case 'PRACTICEQUESTION':
          this.router.navigate([
            `lesson/practice/question/${event.node?.origin.data.lessonpracticeid}`,
          ]);
          break;
        case 'LEARNING':
          this.router.navigate([
            `lesson/learning/${event.node?.origin.data.lessonid}`,
          ]);
          break;
        case 'PRACTICE':
          this.router.navigate([
            `lesson/practice/${event.node?.origin.data.lessonid}`,
          ]);
          break;
        default:
          break;
      }
    }
    event.event?.stopPropagation();
  };
  async ngOnInit() {
    const storagedata = sessionStorage.getItem('JqGJMqfgE9HEU6hC');
    if (storagedata) {
      this.nodes = JSON.parse(storagedata);
      return;
    }
    const data: any = await this.cts.tree().toPromise();
    this.nodes = this._utilService.converttotree(data.data);
  }
  nzEvent(event: NzFormatEmitEvent): void {}
  openFolder(data: NzTreeNode | NzFormatEmitEvent): void {
    // do something if u want
    if (data instanceof NzTreeNode) {
      data.isExpanded = !data.isExpanded;
    } else {
      const node = data.node;
      if (node) {
        node.isExpanded = !node.isExpanded;
      }
    }
  }
}
