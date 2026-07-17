import { Component, OnInit } from '@angular/core';
import { Color, LegendPosition, ScaleType } from '@swimlane/ngx-charts';
import { BehaviorSubject, lastValueFrom, Observable, of } from 'rxjs';
import { catchError, debounceTime, first, map, switchMap } from 'rxjs/operators';
import { ResponseBody } from 'src/app/models/response.model';
import { CountryService } from 'src/app/services/country.service';
import { ReportService } from 'src/app/services/report.service';
import { single, offlineOnlineData } from './charts-data/data1';
import { ChartItemFormat, LineChartFormat } from './models/LineChartFormat';

@Component({
    selector: 'app-index',
    templateUrl: './index.component.html',
    styleUrls: ['./index.component.less'],
    standalone: false
})
export class IndexComponent implements OnInit {

  multi: any;
  view: [number, number] = [1200, 400];

  // options
  legend: boolean = true;
  showLabels: boolean = true;
  lineLegendTitle = 'Type';
  animations: boolean = true;
  xAxis: boolean = true;
  yAxis: boolean = true;
  showYAxisLabel: boolean = true;
  showXAxisLabel: boolean = true;
  yAxisLabel: string = 'Amount';
  timeline: boolean = false;

  colorScheme: Color = {
    name: 'myScheme',
    selectable: true,
    group: ScaleType.Linear,
    domain: ['#005d43', '#d86d28', '#e4d161', '#f9f1e5']
  };

  //pie charts
  single: any;
  viewPie: [number, number] = [500, 300];
  // options
  gradient: boolean = true;
  showLegend: boolean = true;
  pieLegendTitle = 'Gender';
  isDoughnut: boolean = false;
  legendPosition = LegendPosition.Right;

  //pie charts online offline
  offlineOnlineData: any;
  offlineOnlineView: [number, number] = [550, 300];
  // options
  offlineOnlinePieLegendTitle = 'Access';

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
    countryid: '',
  }

  // list of years
  selectedYear = new Date().getFullYear();
  listOfYears: number[] = [];
  // search country
  searchCountryChange$ = new BehaviorSubject({
    countryname: '',
  });
  countryList: any[] = [];
  isCountryLoading = false;

  constructor(
    private reportService: ReportService,
    private countryService: CountryService,
  ) {}
  async ngOnInit() {
    await this.loadDataFromServer();
    this.setupSearchCountry();
    this.listOfYears = this.getYears();
  }

  async loadDataFromServer() {
    const country = this.searchFields.countryid;
    const dashboradcharts: ResponseBody<Array<LineChartFormat>> = await lastValueFrom(this.reportService
      .getDashboard(country, this.selectedYear)
      .pipe(first()));
    Object.assign(this, { multi: dashboradcharts.data });
    const studentsGender: ResponseBody<Array<ChartItemFormat>> = await lastValueFrom(this.reportService
      .getStudentsGender(country)
      .pipe(first()));
    Object.assign(this, { single: studentsGender.data });
    const studentsOfflineOnline: ResponseBody<Array<ChartItemFormat>> = await lastValueFrom(this.reportService
      .getStudentsOfflineOnline('', country)
      .pipe(first()));
    Object.assign(this, { offlineOnlineData: studentsOfflineOnline.data });
    const studentsDisability: ResponseBody<Array<ChartItemFormat>> = await lastValueFrom(this.reportService
      .getStudentsDisability(country)
      .pipe(first()));
    Object.assign(this, { disabilityData: studentsDisability.data });
  }

  dateTickFormatting(val: string): string {
    return (new Date(val)).toLocaleString('default', { month: 'short' });
  }

  numberFormatting(val: number): number {
    return val;
  }

  setupSearchCountry() {
    const countryList$: Observable<string[]> = this.searchCountryChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getCountryList));
    countryList$.subscribe((data) => {
      this.countryList = data;
      this.countryList.unshift({countryid: 'all', countryname: 'All'});
      this.isCountryLoading = false;
      if(!this.searchFields.countryid){
        this.searchFields.countryid = this.countryList[0]?.countryid ?? null;
        this.loadDataFromServer();
      }
    });
  }

  onSearchCountry(value: string): void {
    this.isCountryLoading = true;
    this.searchCountryChange$.next({
      countryname: value,
    });
  }

  getCountryList = (search: { countryname: string }): Observable<any> =>
    this.countryService
      .getAllCountries(search.countryname)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

  onSelected(year: any){
    this.selectedYear = year;
    this.loadDataFromServer();
  }

  getYears(startYear: number = 2022) {
      var currentYear = new Date().getFullYear(), years = []; 
      while ( startYear <= currentYear ) {
          years.push(startYear++);
      }   
      return years;
    }

}
