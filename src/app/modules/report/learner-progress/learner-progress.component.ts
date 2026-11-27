import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { IMultiFilter } from 'src/app/models/IPaging';
import { ReportService } from 'src/app/services/report.service';
import { SchoolService } from 'src/app/services/school.service';
import { StandardService } from 'src/app/services/standard.service';
import {
  LearnerCurriculum,
  LearnerProgressRow,
  currentModuleLabel,
  fullName,
  lastActiveLabel,
  modulesLabel,
  progressLabel,
} from './learner-progress.format';

/**
 * Reports > Learner progress: every learner the user may see, with the same lesson and module counts the learner app
 * shows. Central proxies the student API; the numbers come back ready, and the percent is shown as given.
 */
@Component({
  selector: 'app-learner-progress',
  standalone: false,
  templateUrl: './learner-progress.component.html',
  styleUrls: ['./learner-progress.component.less'],
})
export class LearnerProgressComponent implements OnInit {
  readonly pageSize = 20;
  readonly rows = signal<LearnerProgressRow[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(1);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly schools = signal<Array<{ schoolid: string; schoolname: string }>>([]);
  readonly classes = signal<Array<{ standardid: string; standardname: string }>>([]);

  schoolid: string | null = null;
  standardid: string | null = null;
  search = '';

  private readonly search$ = new Subject<string>();
  private requestNo = 0;
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly reportService: ReportService,
    private readonly schoolService: SchoolService,
    private readonly standardService: StandardService,
  ) {}

  ngOnInit(): void {
    this.schoolService.getAllSchools('', '').subscribe({
      next: (a: any) => this.schools.set(a?.data ?? []),
      error: () => this.schools.set([]),
    });
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load(1));
    this.load(1);
  }

  onSearchInput(value: string): void {
    this.search = value;
    this.search$.next(value.trim());
  }

  onSchoolChange(schoolid: string | null): void {
    this.schoolid = schoolid;
    this.standardid = null;
    this.classes.set([]);
    if (schoolid) {
      this.standardService.getSchoolidStandard(schoolid).subscribe({
        next: (a: any) => {
          if (this.schoolid === schoolid) this.classes.set(a?.data ?? []);
        },
        error: () => this.classes.set([]),
      });
    }
    this.load(1);
  }

  onClassChange(): void {
    this.load(1);
  }

  onPageChange(index: number): void {
    this.load(index);
  }

  load(pageindex: number): void {
    const filter: IMultiFilter[] = [];
    if (this.schoolid) filter.push({ key: 'schoolid', value: this.schoolid });
    if (this.standardid) filter.push({ key: 'standard', value: this.standardid });
    const text = this.search.trim();
    if (text) filter.push({ key: 'search', value: text });
    const no = ++this.requestNo;
    this.loading.set(true);
    this.failed.set(false);
    this.pageIndex.set(pageindex);
    this.reportService.getLearnerProgress({ pageindex, pagesize: this.pageSize, filter }).subscribe({
      next: (a: any) => {
        if (no !== this.requestNo) return;
        this.rows.set(a?.data?.data ?? []);
        this.total.set(a?.data?.total ?? 0);
        this.loading.set(false);
      },
      error: () => {
        if (no !== this.requestNo) return;
        this.rows.set([]);
        this.total.set(0);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  // Template helpers: the words themselves live in learner-progress.format.ts.
  readonly name = fullName;
  readonly progressLabel = progressLabel;
  readonly modulesLabel = modulesLabel;
  readonly currentModuleLabel = currentModuleLabel;
  readonly lastActive = (r: LearnerProgressRow) => lastActiveLabel(r.lastlogin, r.lastprogressat);
  /** A learner with no curriculum still gets one empty line, so the row reads as "no programme". */
  readonly lines = (r: LearnerProgressRow): LearnerCurriculum[] => r.curricula ?? [];
  readonly percentOf = (c: LearnerCurriculum): number => (c.lessonsTotal > 0 ? c.percent : 0);
  readonly hasFilter = () => !!(this.schoolid || this.standardid || this.search.trim());
}
