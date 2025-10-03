export interface Response {
  error: boolean;
  data: any;
  errormessage: string;
  logid: string;
}

export interface ResponseBody<T> {
  error: boolean;
  data: T;
  errormessage: string;
  logid: string;
}
