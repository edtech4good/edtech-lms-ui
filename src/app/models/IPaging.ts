
export class IFilter {
  key?: string = "";
  value?: string = "";
}

export class IMultiFilter {
  key: string = "";
  value: Array<string> | string | Date = "";
}

export class IPaging {
  pageindex?: number = 0;
  pagesize?: number = 0;
  filter?: Array<IFilter>;
}

export class IMultiPaging {
  pageindex?: number = 0;
  pagesize?: number = 0;
  filter?: Array<IMultiFilter>;
}

