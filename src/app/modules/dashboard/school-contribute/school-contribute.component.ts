import { Component, OnInit } from '@angular/core';
import { Color, LegendPosition, ScaleType } from '@swimlane/ngx-charts';
import { BehaviorSubject, Observable, of, Subscription } from 'rxjs';
import { catchError, debounceTime, first, map, switchMap } from 'rxjs/operators';
import { ResponseBody } from 'src/app/models/response.model';
import { ChartItemFormat, LineChartFormat } from '../index/models/LineChartFormat';
import { SchoolService } from 'src/app/services/school.service';
import { SchoolContributeService } from 'src/app/services/school-contribute.service';
import { CountryService } from 'src/app/services/country.service';
import saveAs from 'file-saver';

@Component({
    selector: 'app-school-contribute',
    templateUrl: './school-contribute.component.html',
    styleUrls: ['./school-contribute.component.less'],
    standalone: false
})
export class SchoolContributeComponent implements OnInit {
  school: any[] = [];
  country: any[] = [];
  defaultSchool: string = '';
  defualtcountry: string = '';
  storeCountryid: string = '';
  multi_bar_chart: any[] | undefined;
  isSchoolLoading = false;
  isCountryLoading = false;
  downloading = false;
  monthFormat = 'yyyy/MM';
  Date = '';
  // schoolList: any[] = [];
  searchSchoolChange$ = new BehaviorSubject({
    schoolname: '',
    countryid: '',
  });
  searchCountryChange$ = new BehaviorSubject({
    countryname: ''
  })
  dataloading: boolean = false;

  view: [number, number] = [1200, 400];

  // options
  showXAxis = true;
  showYAxis = true;
  gradient = false;
  showLegend = true;
  showXAxisLabel = true;
  xAxisLabel = 'School';
  showYAxisLabel = true;
  yAxisLabel = 'Community contribution';
  roundDomains = true;

  colorScheme: Color = {
    name: 'myScheme',
    selectable: true,
    group: ScaleType.Linear,
    domain: ['#005d43', '#d86d28', '#e4d161', '#f9f1e5']
  };

  gradientPie: boolean = true;
  LegendTitle = 'Type';
  isDoughnut: boolean = false;
  legendPosition = LegendPosition.Below;


  constructor(
    private readonly schoolContributeService: SchoolContributeService,
    private schoolService: SchoolService,
    private countryService: CountryService,
  ) { }

  ngOnInit(): void {
    this.setupSearchSchool();
    this.setupSearchCountry();
  }
    // this.schoolContributeService
    // .getSchoolContributeById()
    // .pipe(first())
    // .subscribe((data: any) => {
    //   this.xAxisLabel = data.data.length > 0 ? data.data[0].schoolname : 'school' ;
    // });
    // const Dashboard : ResponseBody<Array<LineChartFormat>> = await this.schoolContributeService
    // .getAllSchoolContribute('84796237-5b21-495d-845b-901ed4a3cb71',this.defaultSchool)
    // .pipe(first())
    // .toPromise();
    // Object.assign(this, { multi_bar_chart: Dashboard.data});

  async loadDataFromServer() {
    this.schoolContributeService.getAllSchoolContribute(this.defualtcountry,this.defaultSchool,this.Date)
      .pipe(first())
      .subscribe(
        (data: any) => {
          if(data.data){
            Object.assign(this, { multi_bar_chart: data.data });
          }
        }
      )
  }

  async SearchDate(date: string){
    if(date){
      this.Date = date;
      this.loadDataFromServer();
    }else{
      this.Date = '';
      this.loadDataFromServer();
    }
  }

  async SearchCountry(countryid: string){
    if(countryid){
      this.defualtcountry = countryid;
      this.defaultSchool = '';
      this.setupSearchSchool();
      this.loadDataFromServer();
    }else{
      this.defualtcountry = '';
      this.defaultSchool = '';
      this.setupSearchSchool();
    }
  }

  // this.loadDataFromServer();

  async SearchSchool(schoolname: string){
    if(schoolname){
      this.defaultSchool = schoolname;
      this.loadDataFromServer();
    }else{
      this.defaultSchool = '';
      this.loadDataFromServer();
    }
  }

  onSearchCountry(value: string): void {
    this.isCountryLoading = true;
    this.searchCountryChange$.next({
      countryname: value,
    });
  }

  setupSearchCountry() {
    const countryList$: Observable<string[]> = this.searchCountryChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getCountryList));
    countryList$.subscribe((data) => {
      // console.log(data);
      this.country = data;
      if(!this.defualtcountry){
        this.storeCountryid = this.country[0].countryid;
        this.defualtcountry = this.country[0].countryid;
        this.loadDataFromServer();
      }
      this.isCountryLoading = false;
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

  onSearchSchool(value: string): void {
    this.isSchoolLoading = true;
    this.searchSchoolChange$.next({
      schoolname: value,
      countryid: '',
    });
  }

  async setupSearchSchool() {
    const schoolList$: Observable<string[]> = this.searchSchoolChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getSchoolList));
    schoolList$.subscribe((data: any) => {
      this.school = data;
      // if(!this.defaultSchool){
      //   this.defaultSchool = this.school[0].schoolid;
      //   this.loadDataFromServer();
      // }
      this.isSchoolLoading = false;
    });
  }

  getSchoolList = (search: {
    schoolname: string;
    countryid: string;
  }): Observable<any> =>
    this.schoolService
      .getAllSchools(search.schoolname, this.defualtcountry)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

  downloadReportContribute(){
    this.downloading = true;
    return this.schoolContributeService.getReportContribute(this.Date)
      .pipe(
        first(),
        catchError((x) => {
          this.downloading = false;
          return x;
        })
      )
      .subscribe((x: any) => {
        saveAs(x as Blob , "report-schoolcontribute.csv");
        this.downloading = false;
      });
  }
}
