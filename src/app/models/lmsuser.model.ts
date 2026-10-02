
export interface lmsuser {
  lmsuserid: string;
  lmsusername: string;
  firstname: string;
  lastname?: string;
  lmsuserrole: string;
  permissions?: Array<string>;
  /** The organisation the signed-in staff account belongs to (null for a platform account). */
  organisationid?: string | null;
  /** True for a platform account: Super Admin with no organisation. */
  isplatform?: boolean;
}
