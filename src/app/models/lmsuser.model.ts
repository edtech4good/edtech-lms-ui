
export interface lmsuser {
  lmsuserid: string;
  lmsusername: string;
  firstname: string;
  lastname?: string;
  lmsuserrole: string;
  permissions?: Array<string>;
}
