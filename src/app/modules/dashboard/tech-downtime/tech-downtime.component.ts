import { Component, OnInit } from '@angular/core';
import { Color, LegendPosition, ScaleType } from '@swimlane/ngx-charts';
import { lastValueFrom, Observable } from 'rxjs';
import { catchError, first, map } from 'rxjs/operators';
import { ResponseBody } from 'src/app/models/response.model';
import { CountryService } from 'src/app/services/country.service';
import { ReportService } from 'src/app/services/report.service';
import { ChartItemFormat, LineChartFormat } from './models/LineChartFormat';

@Component({
  selector: 'app-tech-downtime',
  templateUrl: './tech-downtime.component.html',
  styleUrls: ['./tech-downtime.component.less']
})
export class TechDowntimeComponent implements OnInit {

  single_bar_chart: any[] | undefined;
  // multi: any[];

  view: any = [1200, 400]

  // options
  showXAxis = true;
  showYAxis = true;
  gradient = false;
  showLegend = true;
  showXAxisLabel = false;
  xAxisLabel = 'Downtime Type';
  showYAxisLabel = false;
  yAxisLabel = 'Numbers of downtime';
  legendTitle: string = 'Type';
  legendPosition = LegendPosition.Below;

  colorScheme: Color = {
    name: 'myScheme',
    selectable: true,
    group: ScaleType.Linear,
    domain: ['#005d43', '#d86d28', '#e4d161', '#f9f1e5', '#211ee6', '#e61e24']
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

  async loadDataFromServer(body?: {startDate: Date, endDate: Date}) {
    const dashboardcharts: ResponseBody<Array<LineChartFormat>> = await lastValueFrom(this.reportService
      .getTechDowntime(body)
      .pipe(first()));
    Object.assign(this, { single_bar_chart: dashboardcharts.data });
  }

  date = null;

  onChange(result: Date[]): void {
    this.loadDataFromServer({startDate: result[0], endDate: result[1]});
  }

}
