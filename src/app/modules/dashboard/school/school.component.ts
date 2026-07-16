import { Component, OnInit } from '@angular/core';
import { Color, LegendPosition, ScaleType } from '@swimlane/ngx-charts';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, debounceTime, first, map, switchMap } from 'rxjs/operators';
import { ResponseBody } from 'src/app/models/response.model';
import { CountryService } from 'src/app/services/country.service';
import { ReportService } from 'src/app/services/report.service';
import { SchoolService } from 'src/app/services/school.service';
import { ChartItemFormat, LineChartFormat } from './models/LineChartFormat';

@Component({
  selector: 'app-school-dashboard',
  templateUrl: './school.component.html',
  styleUrls: ['./school.component.less']
})
export class SchoolComponent implements OnInit {

  country$?: Observable<any>;
  defaultSchool: string = 'fortyk test school';
  single_bar_chart: any[] | undefined;
  // multi: any[];

  view: [number, number] = [1200, 400];

  // options
  showXAxis = true;
  showYAxis = true;
  gradient = false;
  showLegend = true;
  showXAxisLabel = false;
  xAxisLabel = 'Country';
  showYAxisLabel = true;
  yAxisLabel = 'no. of individuals';

  colorScheme: Color = {
    name: 'myScheme',
    selectable: true,
    group: ScaleType.Linear,
    domain: ['#005d43', '#d86d28', '#e4d161', '#f9f1e5']
  };
  showLabels: boolean = true;
  //pie charts
  single: any;
  viewPie: [number, number] = [500, 300];
  // options
  gradientPie: boolean = true;
  pieLegendTitle = 'Gender';
  isDoughnut: boolean = false;
  legendPosition = LegendPosition.Right;

  //pie charts online offline
  offlineOnlineData: any;
  offlineOnlineView: [number, number] = [550, 300];
  // options
  offlineOnlinePieLegendTitle = 'Students';

  //pie chart disability (Washington Group)
  disabilityData: any;
  // Wider than the sibling pies: ngx-charts sizes the legend at ~1/6 of the view
  // width, and "with disability" needs more room than "girls" does. The pie
  // itself is unchanged — height, not width, sets its diameter.
  disabilityView: [number, number] = [780, 300];
  disabilityPieLegendTitle = 'Disability';
  /**
   * Brand green and orange for the two real categories, recessive gray for "not
   * collected" — that bucket is missing data, not a kind of learner, and giving
   * it a categorical hue would read as a third group of people. Gray is dark
   * enough to hold 3:1 against the surface; slice labels and the legend carry
   * identity so nothing depends on colour alone.
   */
  disabilityColorScheme: Color = {
    name: 'disabilityScheme',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#005d43', '#d86d28', '#8a8a8a']
  };

  searchFields = {
    schoolname: '',
  }

  // search school
  searchSchoolChange$ = new BehaviorSubject({
    schoolname: '',
  });
  schoolList: any[] = [];
  isSchoolLoading = false;

  onSelect(event: any) {
    console.log(event);
  }

  constructor(
    private reportService: ReportService,
    private readonly countryService: CountryService,
    private schoolService: SchoolService,
  ) {
    // Object.assign(this, { single_bar_chart })
  }
  async ngOnInit() {
    this.setupSearchSchool();
    // load all country
    // this.country$ = this.countryService.getall({ pagesize: 200 }).pipe(
    //   catchError((x: any) => []),
    //   first(),
    //   map((x: any) => {
    //     this.defaultCountry = x.data.data[0]?.countryid ?? null;
    //     this.loadDataFromServer();
    //     return x.data.data;
    //   })
    // );
    // this.country$.subscribe();
  }

  async loadDataFromServer() {
    const school = this.searchFields.schoolname;
    const dashboardcharts: ResponseBody<Array<ChartItemFormat>> = await this.reportService
      .getDashboardData(school)
      .pipe(first())
      .toPromise();
    Object.assign(this, { single_bar_chart: dashboardcharts.data });
    const studentsGender: ResponseBody<Array<ChartItemFormat>> = await this.reportService
      .getStudentsGender('', school)
      .pipe(first())
      .toPromise();
    Object.assign(this, { single: studentsGender.data });
    const studentsOfflineOnline: ResponseBody<Array<ChartItemFormat>> = await this.reportService
      .getStudentsOfflineOnline(school)
      .pipe(first())
      .toPromise();
    Object.assign(this, { offlineOnlineData: studentsOfflineOnline.data });
    const studentsDisability: ResponseBody<Array<ChartItemFormat>> = await this.reportService
      .getStudentsDisability('', school)
      .pipe(first())
      .toPromise();
    Object.assign(this, { disabilityData: studentsDisability.data });
  }

  dateTickFormatting(val: string): string {
    return (new Date(val)).toLocaleString('default', { month: 'short' });
  }

  numberFormatting(val: number): number {
    return val;
  }

  onSelected(countryid: any){
    this.defaultSchool = countryid;
    this.loadDataFromServer();
  }

  setupSearchSchool() {
    const schoolList$: Observable<string[]> = this.searchSchoolChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getSchoolList));
    schoolList$.subscribe((data) => {
      this.schoolList = data;
      if(!this.searchFields.schoolname){
        this.searchFields.schoolname = this.schoolList[0]?.schoolname ?? null;
        this.loadDataFromServer();
      }
      this.isSchoolLoading = false;
    });
  }

  onSearchSchool(value: string): void {
    this.isSchoolLoading = true;
    this.searchSchoolChange$.next({
      schoolname: value,
    });
  }

  getSchoolList = (search: {
    schoolname: string
  } = {schoolname: ''}
  ): Observable<any> =>
    this.schoolService
      .getAllSchools(search.schoolname, '')
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

}
