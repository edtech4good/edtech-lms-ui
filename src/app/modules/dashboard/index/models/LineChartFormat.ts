export interface ChartItemFormat {
    name: Date | string;
    value: number;
}

export interface LineChartFormat {
    name: string;
    series: Array<ChartItemFormat>;
}