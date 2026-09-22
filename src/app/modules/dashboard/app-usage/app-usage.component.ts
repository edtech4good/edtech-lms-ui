import { Component, OnInit } from '@angular/core';
import { Color, LegendPosition, ScaleType } from '@swimlane/ngx-charts';
import { lastValueFrom, Observable } from 'rxjs';
import { catchError, first, map } from 'rxjs/operators';
import { ResponseBody } from 'src/app/models/response.model';
import { CountryService } from 'src/app/services/country.service';
import { ReportService } from 'src/app/services/report.service';
import { ChartItemFormat, LineChartFormat } from './models/LineChartFormat';
import { CHART_SERIES } from '../chart-palette';

@Component({
    selector: 'app-appusage-dashboard',
    templateUrl: './app-usage.component.html',
    styleUrls: ['./app-usage.component.less'],
    standalone: false
})
export class AppUsageComponent implements OnInit {

  multi: any[] | undefined;
  // multi: any[];

  view: [number, number] = [1200, 400];

  // options
  showXAxis = true;
  showYAxis = true;
  gradient = false;
  showLegend = true;
  showXAxisLabel = true;
  xAxisLabel = 'Time spent on app';
  showYAxisLabel = true;
  yAxisLabel = 'IMPACT';
  legendTitle: string = 'Type';
  legendPosition = LegendPosition.Below;

  colorScheme: Color = {
    name: 'myScheme',
    selectable: true,
    group: ScaleType.Linear,
    domain: CHART_SERIES
  };
  showLabels: boolean = true;

  onSelect(event: any) {
    console.log(event);
  }

  constructor(
    private reportService: ReportService,
  ) {}
  async ngOnInit() {
    await this.loadDataFromServer()
  }

  async loadDataFromServer() {
    const dashboardcharts: ResponseBody<Array<LineChartFormat>> = await lastValueFrom(this.reportService
      .getStudentUsages()
      .pipe(first()));
    Object.assign(this, { multi: dashboardcharts.data });
  }

}
