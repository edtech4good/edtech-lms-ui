import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, debounceTime, map, switchMap } from 'rxjs/operators';
import { CountryService } from 'src/app/services/country.service';
import { GradeService } from 'src/app/services/grade.service';
import { ReportService } from 'src/app/services/report.service';
import { SchoolService } from 'src/app/services/school.service';
import { StudentService } from 'src/app/services/student.service';
import { EMPTY_MESSAGE, StudentAward, awardsErrorMessage, awardsRequest, awardsSummary, newestFirst } from '../../awards/awards';

/**
 * The Awards report: which module awards one learner has earned, and when. The learner is picked the way the level-progress
 * report picks one (country, school, learner, and an optional grade). Read-only. The offline route answers by default; the
 * online variant (the /online route, or ?online=true as the other reports have it) asks the learning server through central.
 */
@Component({
  selector: 'app-student-awards',
  templateUrl: './student-awards.component.html',
  standalone: false,
})
export class StudentAwardsComponent implements OnInit {
  online = false;
  state: 'idle' | 'loading' | 'error' | 'empty' | 'ready' = 'idle';
  rows: StudentAward[] = [];
  total = 0;
  summary = '';
  readonly emptyMessage = EMPTY_MESSAGE;
  errorMessage = awardsErrorMessage(null);

  searchFields = { countryid: '', schoolname: '', studentid: '', gradeid: '' };

  countryList: any[] = [];
  isCountryLoading = false;
  private searchCountry$ = new BehaviorSubject({ countryname: '' });
  schoolList: any[] = [];
  isSchoolLoading = false;
  private searchSchool$ = new BehaviorSubject({ schoolname: '', countryid: '' });
  userList: any[] = [];
  isUserLoading = false;
  private searchUser$ = new BehaviorSubject({ userid: '', schoolname: '' });
  gradeList: any[] = [];
  isGradeLoading = false;
  private searchGrade$ = new BehaviorSubject({ gradename: '', studentid: '' });

  constructor(
    private readonly reports: ReportService,
    private readonly countryService: CountryService,
    private readonly schoolService: SchoolService,
    private readonly studentService: StudentService,
    private readonly gradeService: GradeService,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.listen(this.searchCountry$, (s) => this.countryService.getAllCountries(s.countryname), (d) => {
      this.countryList = d;
      this.isCountryLoading = false;
    });
    this.listen(this.searchSchool$, (s) => this.schoolService.getAllSchools(s.schoolname, s.countryid), (d) => {
      this.schoolList = d;
      this.isSchoolLoading = false;
    });
    this.listen(this.searchUser$, (s) => this.studentService.getAllUsers(s.userid, s.schoolname), (d) => {
      this.userList = d;
      this.isUserLoading = false;
    });
    this.listen(this.searchGrade$, (s) => this.gradeService.getAllGrades(s.gradename, '', s.studentid), (d) => {
      this.gradeList = d;
      this.isGradeLoading = false;
    });
    this.online = this.route.snapshot.url.some((u) => u.path === 'online');
    this.route.queryParams.subscribe((p) => {
      if (p.online === 'true') this.online = true;
    });
  }

  private listen<T>(subject: BehaviorSubject<T>, fetch: (s: T) => Observable<any>, set: (rows: any[]) => void): void {
    subject
      .asObservable()
      .pipe(
        debounceTime(500),
        switchMap((s) =>
          fetch(s).pipe(
            catchError(() => of({ data: [] })),
            map((res: any) => (Array.isArray(res?.data) ? res.data : []))
          )
        )
      )
      .subscribe(set);
  }

  onSearchCountry(value: string): void {
    this.isCountryLoading = true;
    this.searchCountry$.next({ countryname: value });
  }
  onSearchSchool(value: string): void {
    this.isSchoolLoading = true;
    this.searchSchool$.next({ schoolname: value, countryid: this.searchFields.countryid ?? '' });
  }
  onSearchUser(value: string): void {
    this.isUserLoading = true;
    this.searchUser$.next({ userid: value, schoolname: this.searchFields.schoolname ?? '' });
  }
  onSearchGrade(value: string): void {
    this.isGradeLoading = true;
    this.searchGrade$.next({ gradename: value, studentid: this.searchFields.studentid ?? '' });
  }

  search(): void {
    if (!this.searchFields.studentid) return;
    this.state = 'loading';
    this.reports
      .getStudentAwards(awardsRequest(this.searchFields.studentid, this.searchFields.gradeid ?? ''), this.online)
      .subscribe({
        next: (res: any) => {
          const rows: StudentAward[] = Array.isArray(res?.data?.data) ? res.data.data : [];
          this.rows = newestFirst(rows);
          this.total = Number(res?.data?.total ?? this.rows.length);
          this.summary = awardsSummary(this.total, this.rows.filter((r) => r.earnedat_approximate).length);
          this.state = this.rows.length === 0 ? 'empty' : 'ready';
        },
        error: (err: any) => {
          this.rows = [];
          this.errorMessage = awardsErrorMessage(err?.status);
          this.state = 'error';
        },
      });
  }
}
